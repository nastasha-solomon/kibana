/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import moment from 'moment';
import { BehaviorSubject } from 'rxjs';
import React from 'react';

import useObservable from 'react-use/lib/useObservable';

import type { EuiDataGridColumn } from '@elastic/eui';
import { euiPaletteColorBlind } from '@elastic/eui';

import { i18n } from '@kbn/i18n';
import { KBN_FIELD_TYPES } from '@kbn/data-plugin/public';
import {
  isNumericChartData,
  isOrdinalChartData,
  type ChartData,
  type ChartDataItem,
  type NumericDataItem,
  type OrdinalDataItem,
} from '@kbn/ml-data-grid';
import { useColumnChartStyles } from './column_chart_styles';

const NON_AGGREGATABLE = 'non-aggregatable';

export const hoveredRow$ = new BehaviorSubject<any | null>(null);

export const BAR_COLOR = euiPaletteColorBlind()[0];
const BAR_COLOR_BLUR = euiPaletteColorBlind({ rotations: 2 })[10];

type XScaleType = 'ordinal' | 'time' | 'linear' | undefined;
export const getXScaleType = (kbnFieldType: KBN_FIELD_TYPES | undefined): XScaleType => {
  switch (kbnFieldType) {
    case KBN_FIELD_TYPES.BOOLEAN:
    case KBN_FIELD_TYPES.IP:
    case KBN_FIELD_TYPES.STRING:
      return 'ordinal';
    case KBN_FIELD_TYPES.DATE:
      return 'time';
    case KBN_FIELD_TYPES.NUMBER:
      return 'linear';
  }
};

export const getFieldType = (schema: EuiDataGridColumn['schema']): KBN_FIELD_TYPES | undefined => {
  if (schema === NON_AGGREGATABLE) {
    return undefined;
  }

  let fieldType: KBN_FIELD_TYPES;

  switch (schema) {
    case 'datetime':
      fieldType = KBN_FIELD_TYPES.DATE;
      break;
    case 'numeric':
      fieldType = KBN_FIELD_TYPES.NUMBER;
      break;
    case 'boolean':
      fieldType = KBN_FIELD_TYPES.BOOLEAN;
      break;
    case 'json':
      fieldType = KBN_FIELD_TYPES.OBJECT;
      break;
    default:
      fieldType = KBN_FIELD_TYPES.STRING;
  }

  return fieldType;
};

type LegendText = string | JSX.Element;
export const getLegendText = (
  chartData: ChartData,
  maxChartColumns: number,
  isNumeric = false,
  styles: ReturnType<typeof useColumnChartStyles>
): LegendText => {
  if (chartData.type === 'unsupported') {
    return i18n.translate('xpack.dataVisualizer.dataGridChart.histogramNotAvailable', {
      defaultMessage: 'Chart not supported.',
    });
  }

  if (chartData.data.length === 0) {
    return '';
  }

  if (chartData.type === 'boolean') {
    return (
      <table>
        <tbody>
          <tr>
            {chartData.data[0] !== undefined && (
              <td css={styles.legendBoolean}>
                {chartData.data[0].key_as_string?.slice(0, 1) ?? ''}
              </td>
            )}
            {chartData.data[1] !== undefined && (
              <td css={styles.legendBoolean}>
                {chartData.data[1].key_as_string?.slice(0, 1) ?? ''}
              </td>
            )}
          </tr>
        </tbody>
      </table>
    );
  }

  if (isOrdinalChartData(chartData) && isNumeric) {
    // The original data could be numerical but also ordinal (e.g. "2340")
    return i18n.translate('xpack.dataVisualizer.dataGridChart.singleTopValueLegend', {
      defaultMessage: `{cardinality, plural, one {# value {exampleValue}} other {# values}}`,
      values: {
        cardinality: chartData.cardinality,
        exampleValue: chartData.data[0].key ? `(${chartData.data[0].key})` : '',
      },
    });
  }

  if (isOrdinalChartData(chartData) && chartData.cardinality <= maxChartColumns) {
    return i18n.translate('xpack.dataVisualizer.dataGridChart.singleCategoryLegend', {
      defaultMessage: `{cardinality, plural, one {# category} other {# categories}}`,
      values: { cardinality: chartData.cardinality },
    });
  }

  if (isOrdinalChartData(chartData) && chartData.cardinality > maxChartColumns) {
    return i18n.translate('xpack.dataVisualizer.dataGridChart.topCategoriesLegend', {
      defaultMessage: `top {maxChartColumns} of {cardinality} categories`,
      values: { cardinality: chartData.cardinality, maxChartColumns },
    });
  }

  if (isNumericChartData(chartData)) {
    const fromValue = Math.round(chartData.stats[0] * 100) / 100;
    const toValue = Math.round(chartData.stats[1] * 100) / 100;

    return fromValue !== toValue ? `${fromValue} - ${toValue}` : '' + fromValue;
  }

  return '';
};

interface ColumnChart {
  data: ChartDataItem[];
  legendText: LegendText;
  xScaleType: XScaleType;
}

export const useColumnChart = (
  chartData: ChartData,
  columnType: EuiDataGridColumn,
  maxChartColumns: number,
  isNumeric?: boolean
): ColumnChart => {
  const fieldType = getFieldType(columnType.schema);

  const hoveredRow = useObservable(hoveredRow$);

  const xScaleType = getXScaleType(fieldType);

  const styles = useColumnChartStyles();

  const getColor = (d: ChartDataItem) => {
    if (hoveredRow === undefined || hoveredRow === null) {
      return BAR_COLOR;
    }

    if (
      isOrdinalChartData(chartData) &&
      xScaleType === 'ordinal' &&
      hoveredRow._source[columnType.id] === d.key
    ) {
      return BAR_COLOR;
    }

    if (
      isNumericChartData(chartData) &&
      xScaleType === 'linear' &&
      hoveredRow._source[columnType.id] >= +d.key &&
      hoveredRow._source[columnType.id] < +d.key + chartData.interval
    ) {
      return BAR_COLOR;
    }

    if (
      isNumericChartData(chartData) &&
      xScaleType === 'time' &&
      moment(hoveredRow._source[columnType.id]).unix() * 1000 >= +d.key &&
      moment(hoveredRow._source[columnType.id]).unix() * 1000 < +d.key + chartData.interval
    ) {
      return BAR_COLOR;
    }

    return BAR_COLOR_BLUR;
  };

  let data: ChartDataItem[] = [];

  // The if/else if/else is a work-around because `.map()` doesn't work with union types.
  // See TS Caveats for details: https://www.typescriptlang.org/docs/handbook/release-notes/typescript-3-3.html#caveats
  if (isOrdinalChartData(chartData)) {
    data = chartData.data.map((d: OrdinalDataItem, idx) => ({
      ...d,
      x: idx,
      key_as_string: d.key_as_string ?? d.key,
      color: getColor(d),
    }));
  } else if (isNumericChartData(chartData)) {
    data = chartData.data.map((d: NumericDataItem, idx) => ({
      ...d,
      x: idx,
      key_as_string: d.key_as_string || d.key,
      color: getColor(d),
    }));
  }

  return {
    data,
    legendText: getLegendText(chartData, maxChartColumns, isNumeric, styles),
    xScaleType,
  };
};
