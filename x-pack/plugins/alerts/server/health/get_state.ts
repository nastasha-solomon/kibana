/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { i18n } from '@kbn/i18n';
import { defer, of, interval, Observable, throwError, timer } from 'rxjs';
import { catchError, mergeMap, retryWhen, switchMap } from 'rxjs/operators';
import { ServiceStatus, ServiceStatusLevels } from '../../../../../src/core/server';
import { TaskManagerStartContract } from '../../../task_manager/server';
import { HEALTH_TASK_ID } from './task';
import { HealthStatus } from '../types';

export const MAX_RETRY_ATTEMPTS = 3;
const HEALTH_STATUS_INTERVAL = 60000 * 5; // Five minutes
const RETRY_DELAY = 5000; // Wait 5 seconds before retrying on errors

async function getLatestTaskState(taskManager: TaskManagerStartContract) {
  try {
    const result = await taskManager.get(HEALTH_TASK_ID);
    return result;
  } catch (err) {
    const errMessage = err && err.message ? err.message : err.toString();
    if (!errMessage.includes('NotInitialized')) {
      throw err;
    }
  }

  return null;
}

const LEVEL_SUMMARY = {
  [ServiceStatusLevels.available.toString()]: i18n.translate(
    'xpack.alerts.server.healthStatus.available',
    {
      defaultMessage: 'Alerting framework is available',
    }
  ),
  [ServiceStatusLevels.degraded.toString()]: i18n.translate(
    'xpack.alerts.server.healthStatus.degraded',
    {
      defaultMessage: 'Alerting framework is degraded',
    }
  ),
  [ServiceStatusLevels.unavailable.toString()]: i18n.translate(
    'xpack.alerts.server.healthStatus.unavailable',
    {
      defaultMessage: 'Alerting framework is unavailable',
    }
  ),
};

const getHealthServiceStatus = async (
  taskManager: TaskManagerStartContract
): Promise<ServiceStatus<unknown>> => {
  const doc = await getLatestTaskState(taskManager);
  const level =
    doc?.state?.health_status === HealthStatus.OK
      ? ServiceStatusLevels.available
      : doc?.state?.health_status === HealthStatus.Warning
      ? ServiceStatusLevels.degraded
      : ServiceStatusLevels.unavailable;
  return {
    level,
    summary: LEVEL_SUMMARY[level.toString()],
  };
};

export const getHealthServiceStatusWithRetryAndErrorHandling = (
  taskManager: TaskManagerStartContract,
  retryDelay?: number
): Observable<ServiceStatus<unknown>> => {
  return defer(() => getHealthServiceStatus(taskManager)).pipe(
    retryWhen((errors) => {
      return errors.pipe(
        mergeMap((error, i) => {
          const retryAttempt = i + 1;
          if (retryAttempt > MAX_RETRY_ATTEMPTS) {
            return throwError(error);
          }
          return timer(retryDelay ?? RETRY_DELAY);
        })
      );
    }),
    catchError((error) => {
      return of({
        level: ServiceStatusLevels.unavailable,
        summary: LEVEL_SUMMARY[ServiceStatusLevels.unavailable.toString()],
        meta: { error },
      });
    })
  );
};

export const getHealthStatusStream = (
  taskManager: TaskManagerStartContract,
  healthStatusInterval?: number,
  retryDelay?: number
): Observable<ServiceStatus<unknown>> =>
  interval(healthStatusInterval ?? HEALTH_STATUS_INTERVAL).pipe(
    switchMap(() => getHealthServiceStatusWithRetryAndErrorHandling(taskManager, retryDelay))
  );
