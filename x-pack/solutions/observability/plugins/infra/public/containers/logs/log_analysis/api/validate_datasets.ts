/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import type { estypes } from '@elastic/elasticsearch';
import type { HttpHandler } from '@kbn/core/public';
import { decodeOrThrow } from '@kbn/io-ts-utils';
import {
  LOG_ANALYSIS_VALIDATE_DATASETS_PATH,
  validateLogEntryDatasetsRequestPayloadRT,
  validateLogEntryDatasetsResponsePayloadRT,
} from '../../../../../common/http_api';

interface RequestArgs {
  indices: string[];
  timestampField: string;
  startTime: number;
  endTime: number;
  runtimeMappings: estypes.MappingRuntimeFields;
}

export const callValidateDatasetsAPI = async (requestArgs: RequestArgs, fetch: HttpHandler) => {
  const { indices, timestampField, startTime, endTime, runtimeMappings } = requestArgs;
  const response = await fetch(LOG_ANALYSIS_VALIDATE_DATASETS_PATH, {
    method: 'POST',
    body: JSON.stringify(
      validateLogEntryDatasetsRequestPayloadRT.encode({
        data: {
          endTime,
          indices,
          startTime,
          timestampField,
          runtimeMappings,
        },
      })
    ),
    version: '1',
  });

  return decodeOrThrow(validateLogEntryDatasetsResponsePayloadRT)(response);
};
