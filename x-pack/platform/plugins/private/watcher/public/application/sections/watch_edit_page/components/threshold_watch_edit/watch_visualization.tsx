/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import React, { Fragment, useContext, useEffect, useMemo } from 'react';
import {
  AnnotationDomainType,
  Axis,
  Chart,
  LegendValue,
  LineAnnotation,
  LineSeries,
  PartialTheme,
  Position,
  ScaleType,
  Settings,
} from '@elastic/charts';
import dateMath from '@kbn/datemath';
import moment from 'moment-timezone';
import { IUiSettingsClient } from '@kbn/core/public';
import { EuiCallOut, EuiLoadingChart, EuiSpacer, EuiEmptyPrompt, EuiText } from '@elastic/eui';
import { FormattedMessage } from '@kbn/i18n-react';

import { i18n } from '@kbn/i18n';
import { VisualizeOptions } from '../../../../models/visualize_options';
import { ThresholdWatch } from '../../../../models/watch/threshold_watch';

import { useGetWatchVisualizationData } from '../../../../lib/api';
import { WatchContext } from '../../watch_context';
import { aggTypes } from '../../../../models/watch/agg_types';
import { comparators } from '../../../../models/watch/comparators';
import { SectionError, Error } from '../../../../components';
import { useAppContext } from '../../../../app_context';

const customTheme = (): PartialTheme => {
  return {
    lineSeriesStyle: {
      line: {
        strokeWidth: 3,
      },
      point: {
        visible: 'never',
      },
    },
  };
};

const getTimezone = (config: IUiSettingsClient) => {
  const DATE_FORMAT_CONFIG_KEY = 'dateFormat:tz';
  const isCustomTimezone = !config.isDefault(DATE_FORMAT_CONFIG_KEY);
  if (isCustomTimezone) {
    return config.get(DATE_FORMAT_CONFIG_KEY);
  }

  const detectedTimezone = moment.tz.guess();
  if (detectedTimezone) {
    return detectedTimezone;
  }
  // default to UTC if we can't figure out the timezone
  return moment().format('Z');
};

const getDomain = (watch: any) => {
  const VISUALIZE_TIME_WINDOW_MULTIPLIER = 5;
  const fromExpression = `now-${watch.timeWindowSize * VISUALIZE_TIME_WINDOW_MULTIPLIER}${
    watch.timeWindowUnit
  }`;
  const toExpression = 'now';
  const fromMoment = dateMath.parse(fromExpression);
  const toMoment = dateMath.parse(toExpression);
  const visualizeTimeWindowFrom = fromMoment ? fromMoment.valueOf() : 0;
  const visualizeTimeWindowTo = toMoment ? toMoment.valueOf() : 0;
  return {
    min: visualizeTimeWindowFrom,
    max: visualizeTimeWindowTo,
  };
};

const getThreshold = (watch: any) => {
  return watch.threshold.slice(0, comparators[watch.thresholdComparator].requiredValues);
};

const getTimeBuckets = (watch: any, timeBuckets: any) => {
  const domain = getDomain(watch);
  timeBuckets.setBounds(domain);
  return timeBuckets;
};

export const WatchVisualization = () => {
  const { createTimeBuckets, chartsTheme, uiSettings } = useAppContext();
  const { watch } = useContext(WatchContext);
  const chartBaseTheme = chartsTheme.useChartsBaseTheme();
  const {
    index,
    timeField,
    triggerIntervalSize,
    triggerIntervalUnit,
    aggType,
    aggField,
    termSize,
    termField,
    thresholdComparator,
    timeWindowSize,
    timeWindowUnit,
    groupBy,
    threshold,
  } = watch;

  // Only recalculate the domain if the watch configuration changes. This prevents the visualization
  // request's resolution from re-triggering itself in an infinite loop.
  const domain = useMemo(() => getDomain(watch), [watch]);
  const timeBuckets = createTimeBuckets();
  timeBuckets.setBounds(domain);
  const interval = timeBuckets.getInterval().expression;
  const visualizeOptions = new VisualizeOptions({
    rangeFrom: domain.min,
    rangeTo: domain.max,
    interval,
    timezone: getTimezone(uiSettings),
  });

  // Fetching visualization data is independent of watch actions
  const watchWithoutActions = new ThresholdWatch({ ...watch, actions: [] });

  const {
    isInitialRequest,
    isLoading,
    data: watchVisualizationData,
    error,
    resendRequest: reload,
  } = useGetWatchVisualizationData(watchWithoutActions, visualizeOptions);

  useEffect(
    () => {
      // Prevent sending a second request on initial render.
      if (isInitialRequest) {
        return;
      }
      reload();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      index,
      timeField,
      triggerIntervalSize,
      triggerIntervalUnit,
      aggType,
      aggField,
      termSize,
      termField,
      thresholdComparator,
      timeWindowSize,
      timeWindowUnit,
      groupBy,
      threshold,
    ]
  );

  if (isInitialRequest && isLoading) {
    return (
      <EuiEmptyPrompt
        title={<EuiLoadingChart size="xl" />}
        body={
          <EuiText color="subdued">
            <FormattedMessage
              id="xpack.watcher.sections.watchEdit.loadingWatchVisualizationDescription"
              defaultMessage="Loading watch visualization…"
            />
          </EuiText>
        }
      />
    );
  }

  if (error) {
    return (
      <Fragment>
        <EuiSpacer size="l" />
        <SectionError
          title={
            <FormattedMessage
              id="xpack.watcher.sections.watchEdit.errorLoadingWatchVisualizationTitle"
              defaultMessage="Cannot load watch visualization"
            />
          }
          error={error as unknown as Error}
        />
        <EuiSpacer size="l" />
      </Fragment>
    );
  }

  if (watchVisualizationData) {
    const watchVisualizationDataKeys = Object.keys(watchVisualizationData);
    const timezone = getTimezone(uiSettings);
    const actualThreshold = getThreshold(watch);
    let maxY = actualThreshold[actualThreshold.length - 1];

    (Object.values(watchVisualizationData) as number[][][]).forEach((watchData) => {
      watchData.forEach(([, y]) => {
        if (y > maxY) {
          maxY = y;
        }
      });
    });
    const dateFormatter = (d: number) => {
      return moment(d)
        .tz(timezone)
        .format(getTimeBuckets(watch, createTimeBuckets()).getScaledDateFormat());
    };
    const aggLabel = aggTypes[watch.aggType].text;
    return (
      <div data-test-subj="watchVisualizationChart">
        <EuiSpacer size="l" />
        {watchVisualizationDataKeys.length ? (
          <Chart size={['100%', 300]} renderer="canvas">
            <Settings
              theme={[customTheme()]}
              baseTheme={chartBaseTheme}
              xDomain={domain}
              showLegend={!!watch.termField}
              legendValues={[LegendValue.CurrentAndLastValue]}
              legendPosition={Position.Bottom}
              locale={i18n.getLocale()}
            />
            <Axis
              id="bottom"
              position={Position.Bottom}
              showOverlappingTicks={true}
              tickFormat={dateFormatter}
            />
            <Axis
              domain={{ max: maxY, min: NaN }}
              id="left"
              title={aggLabel}
              position={Position.Left}
            />
            {watchVisualizationDataKeys.map((key: string) => {
              return (
                <LineSeries
                  key={key}
                  id={key}
                  // Defaults to multi layer time axis as of Elastic Charts v70
                  xScaleType={ScaleType.Time}
                  yScaleType={ScaleType.Linear}
                  data={watchVisualizationData[key]}
                  xAccessor={0}
                  yAccessors={[1]}
                  timeZone={timezone}
                />
              );
            })}
            {actualThreshold.map((_value: any, i: number) => {
              const specId = i === 0 ? 'threshold' : `threshold${i}`;
              return (
                <LineAnnotation
                  key={specId}
                  id={specId}
                  domainType={AnnotationDomainType.YDomain}
                  dataValues={[{ dataValue: watch.threshold[i], details: specId }]}
                />
              );
            })}
          </Chart>
        ) : (
          <EuiCallOut
            title={
              <FormattedMessage
                id="xpack.watcher.thresholdPreviewChart.noDataTitle"
                defaultMessage="No data"
              />
            }
            color="warning"
          >
            <FormattedMessage
              id="xpack.watcher.thresholdPreviewChart.dataDoesNotExistTextMessage"
              defaultMessage="Your index and condition did not return any data."
            />
          </EuiCallOut>
        )}
        <EuiSpacer size="l" />
      </div>
    );
  }

  return null;
};
