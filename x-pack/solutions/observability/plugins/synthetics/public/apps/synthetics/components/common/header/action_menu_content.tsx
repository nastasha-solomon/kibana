/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import React from 'react';
import { EuiHeaderLinks, EuiToolTip, EuiHeaderLink } from '@elastic/eui';
import { i18n } from '@kbn/i18n';
import { FormattedMessage } from '@kbn/i18n-react';
import { useHistory, useRouteMatch } from 'react-router-dom';
import { createExploratoryViewUrl } from '@kbn/exploratory-view-plugin/public';
import { LastRefreshed } from '../components/last_refreshed';
import { AutoRefreshButton } from '../components/auto_refresh_button';
import { useSyntheticsSettingsContext } from '../../../contexts';
import { useGetUrlParams } from '../../../hooks';
import {
  MONITOR_ADD_ROUTE,
  MONITOR_EDIT_ROUTE,
  MONITOR_ROUTE,
  SETTINGS_ROUTE,
} from '../../../../../../common/constants';
import { stringifyUrlParams } from '../../../utils/url_params';
import { InspectorHeaderLink } from './inspector_header_link';
import { ToggleAlertFlyoutButton } from '../../alerts/toggle_alert_flyout_button';

const ANALYZE_DATA = i18n.translate('xpack.synthetics.analyzeDataButtonLabel', {
  defaultMessage: 'Explore data',
});

const ANALYZE_MESSAGE = i18n.translate('xpack.synthetics.analyzeDataButtonLabel.message', {
  defaultMessage:
    'Go to Explore Data, where you can select and filter result data in any dimension and look for the cause or impact of performance problems.',
});

export function ActionMenuContent(): React.ReactElement {
  const { basePath } = useSyntheticsSettingsContext();

  const params = useGetUrlParams();
  const { dateRangeStart, dateRangeEnd } = params;
  const history = useHistory();

  const selectedMonitor = {
    monitor: { id: undefined, name: 'test' },
  }; /* useSelector(monitorStatusSelector) TODO: Implement state for monitor status */

  const detailRouteMatch = useRouteMatch(MONITOR_ROUTE);
  const isEditRoute = useRouteMatch(MONITOR_EDIT_ROUTE);
  const isAddRoute = useRouteMatch(MONITOR_ADD_ROUTE);
  const monitorId = selectedMonitor?.monitor?.id;

  const syntheticExploratoryViewLink = createExploratoryViewUrl(
    {
      reportType: 'kpi-over-time',
      allSeries: [
        {
          dataType: 'synthetics',
          seriesType: 'area',
          selectedMetricField: 'monitor.duration.us',
          time: { from: dateRangeStart, to: dateRangeEnd },
          breakdown: monitorId ? 'observer.geo.name' : 'monitor.type',
          reportDefinitions: {
            'monitor.name':
              selectedMonitor?.monitor?.name && detailRouteMatch?.isExact === true
                ? [selectedMonitor?.monitor?.name]
                : [],
            'url.full': ['ALL_VALUES'],
          },
          name: monitorId ? `${monitorId}-response-duration` : 'All monitors response duration',
        },
      ],
    },
    basePath
  );

  return (
    <EuiHeaderLinks gutterSize="xs">
      {!isEditRoute && !isAddRoute && (
        <>
          <LastRefreshed />
          <AutoRefreshButton />
        </>
      )}
      <InspectorHeaderLink />

      <EuiToolTip position="top" content={<p>{ANALYZE_MESSAGE}</p>}>
        <EuiHeaderLink
          aria-label={i18n.translate('xpack.synthetics.page_header.analyzeData.label', {
            defaultMessage: 'Navigate to the "Explore Data" view to visualize Synthetics/User data',
          })}
          href={syntheticExploratoryViewLink}
          color="primary"
          data-test-subj={'syntheticsExploreDataButton'}
        >
          {ANALYZE_DATA}
        </EuiHeaderLink>
      </EuiToolTip>

      <ToggleAlertFlyoutButton />

      <EuiHeaderLink
        aria-label={i18n.translate('xpack.synthetics.page_header.settingsLink.label', {
          defaultMessage: 'Navigate to the Synthetics settings page',
        })}
        color="primary"
        data-test-subj="settings-page-link"
        href={history.createHref({
          pathname: SETTINGS_ROUTE,
          search: stringifyUrlParams(params, true),
        })}
      >
        <FormattedMessage
          id="xpack.synthetics.page_header.settingsLink"
          defaultMessage="Settings"
        />
      </EuiHeaderLink>
    </EuiHeaderLinks>
  );
}
