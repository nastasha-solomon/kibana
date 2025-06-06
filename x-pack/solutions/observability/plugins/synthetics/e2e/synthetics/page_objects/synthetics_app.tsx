/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */
import { expect, Page } from '@elastic/synthetics';
import { RetryService } from '@kbn/ftr-common-functional-services';
import { FormMonitorType } from '@kbn/synthetics-plugin/common/runtime_types/monitor_management';
import { recordVideo } from '@kbn/observability-synthetics-test-data';
import { loginPageProvider } from '../../page_objects/login';
import { utilsPageProvider } from '../../page_objects/utils';

const SIXTY_SEC_TIMEOUT = {
  timeout: 60 * 1000,
};

export function syntheticsAppPageProvider({
  page,
  kibanaUrl,
  params,
}: {
  page: Page;
  kibanaUrl: string;
  params: Record<string, any>;
}) {
  const remoteKibanaUrl = process.env.SYNTHETICS_REMOTE_KIBANA_URL;
  const remoteUsername = process.env.SYNTHETICS_REMOTE_KIBANA_USERNAME;
  const remotePassword = process.env.SYNTHETICS_REMOTE_KIBANA_PASSWORD;
  const isRemote = Boolean(process.env.SYNTHETICS_REMOTE_ENABLED);
  const basePath = isRemote ? remoteKibanaUrl : kibanaUrl;
  const monitorManagement = `${basePath}/app/synthetics/monitors`;
  const settingsPage = `${basePath}/app/synthetics/settings`;
  const addMonitor = `${basePath}/app/synthetics/add-monitor`;
  const overview = `${basePath}/app/synthetics`;
  const retry: RetryService = params?.getService('retry');

  recordVideo(page);
  page.setDefaultTimeout(60 * 1000);

  return {
    ...loginPageProvider({
      page,
      isRemote,
      username: isRemote ? remoteUsername : 'elastic',
      password: isRemote ? remotePassword : 'changeme',
    }),
    ...utilsPageProvider({ page }),

    async navigateToMonitorManagement(doLogin = false) {
      await page.goto(monitorManagement, {
        waitUntil: 'networkidle',
      });
      if (doLogin) {
        await this.loginToKibana();
      }
      await this.waitForMonitorManagementLoadingToFinish();
    },

    async navigateToOverview(doLogin = false, refreshInterval?: number) {
      if (refreshInterval) {
        await page.goto(`${overview}?refreshInterval=${refreshInterval}`, {
          waitUntil: 'networkidle',
        });
      } else {
        await page.goto(overview, { waitUntil: 'networkidle' });
      }
      if (doLogin) {
        await this.loginToKibana();
      }
    },

    async navigateToStepDetails({
      configId,
      stepIndex,
      checkGroup,
      doLogin = true,
    }: {
      checkGroup: string;
      configId: string;
      stepIndex: number;
      doLogin?: boolean;
    }) {
      const stepDetails = `/monitor/${configId}/test-run/${checkGroup}/step/${stepIndex}?locationId=us_central`;
      await page.goto(overview + stepDetails, { waitUntil: 'networkidle' });
      if (doLogin) {
        await this.loginToKibana();
      }
    },

    async waitForMonitorManagementLoadingToFinish() {
      while (true) {
        if ((await page.$(this.byTestId('uptimeLoader'))) === null) break;
        await page.waitForTimeout(5 * 1000);
      }
    },

    async getAddMonitorButton() {
      return await this.findByText('Create monitor');
    },

    async navigateToSettings(doLogin = true) {
      await page.goto(settingsPage, {
        waitUntil: 'networkidle',
      });
      if (doLogin) {
        await this.loginToKibana();
      }
      await page.waitForSelector('h1:has-text("Settings")');
    },

    async navigateToAddMonitor() {
      if (await page.isVisible('[data-test-subj="syntheticsAddMonitorBtn"]')) {
        await page.click('[data-test-subj="syntheticsAddMonitorBtn"]');
      } else {
        await page.goto(addMonitor, {
          waitUntil: 'networkidle',
        });
      }
    },

    async ensureIsOnMonitorConfigPage() {
      await page.isVisible('[data-test-subj=monitorSettingsSection]');
    },

    async confirmAndSave(isUpdate: boolean = false) {
      await this.ensureIsOnMonitorConfigPage();
      await this.clickByTestSubj('syntheticsMonitorConfigSubmitButton');
      return await this.findByText(
        isUpdate ? 'Monitor updated successfully.' : 'Monitor added successfully.'
      );
    },

    async deleteMonitors() {
      if (!page.url().includes('monitors/management')) {
        return true;
      }
      await page.getByTestId('euiCollapsedItemActionsButton').first().click();
      await page.click(`.euiContextMenuPanel ${this.byTestId('syntheticsMonitorDeleteAction')}`, {
        delay: 800,
      });
      await page.waitForSelector('[data-test-subj="confirmModalTitleText"]');
      await page.getByTestId('confirmModalConfirmButton').click();
      await page.getByTestId('uptimeDeleteMonitorSuccess').click();
      await page.getByTestId('syntheticsRefreshButtonButton').click();

      await page.getByTestId('checkboxSelectAll').click();
      await page
        .getByTestId('syntheticsBulkOperationPopoverClickMeToLoadAContextMenuButton')
        .click();

      await page.getByTestId('confirmModalConfirmButton').click();

      return true;
    },

    async navigateToEditMonitor(monitorName: string) {
      await this.adjustRows();
      await page.waitForSelector('text=Showing');
      await page.click(
        `tr:has-text("${monitorName}") [data-test-subj="euiCollapsedItemActionsButton"]`
      );
      await page.click(`.euiContextMenuPanel ${this.byTestId('syntheticsMonitorEditAction')}`, {
        timeout: 2 * 60 * 1000,
        delay: 800,
      });
      await this.findByText('Edit monitor');
    },

    async selectLocations({ locations }: { locations: string[] }) {
      for (let i = 0; i < locations.length; i++) {
        await page.click(
          this.byTestId(`syntheticsServiceLocation--${locations[i]}`),
          SIXTY_SEC_TIMEOUT
        );
      }
    },

    async selectLocationsAddEdit({ locations }: { locations: string[] }) {
      for (let i = 0; i < locations.length; i++) {
        await retry.try(async () => {
          await page.click(this.byTestId('syntheticsMonitorConfigLocations'));
          await page.click(`text=${locations[i]}`);
        });
      }
    },

    async selectFrequencyAddEdit({
      value,
      unit,
    }: {
      value: number;
      unit: 'minute' | 'minutes' | 'hours';
    }) {
      await page.click(this.byTestId('syntheticsMonitorConfigSchedule'));

      const optionLocator = page.locator(`text=Every ${value} ${unit}`);
      await optionLocator.evaluate((element: HTMLOptionElement) => {
        if (element && element.parentElement) {
          (element.parentElement as HTMLSelectElement).selectedIndex = element.index;
        }
      });
    },

    async fillFirstMonitorDetails({ url, locations }: { url: string; locations: string[] }) {
      await this.fillByTestSubj('urls-input', url);
      await page.click(this.byTestId('comboBoxInput'));
      await this.selectLocations({ locations });
      await page.click(this.byTestId('urls-input'));
    },

    async selectMonitorType(monitorType: string) {
      await this.clickByTestSubj(monitorType);
    },

    async findMonitorConfiguration(monitorConfig: Record<string, string>) {
      const values = Object.values(monitorConfig);

      for (let i = 0; i < values.length; i++) {
        await this.findByText(values[i]);
      }
    },

    async findEditMonitorConfiguration(monitorConfig: Array<[string, string]>) {
      await page.click('text="Advanced options"');

      for (let i = 0; i < monitorConfig.length; i++) {
        const [selector, expected] = monitorConfig[i];
        if (selector.includes('codeEditorContainer')) {
          expect(page.locator(selector)).toHaveText(expected);
        } else {
          const actual = await page.inputValue(selector);
          expect(actual).toEqual(expected);
        }
      }
    },

    async fillCodeEditor(value: string) {
      await page.fill('[data-test-subj=codeEditorContainer] textarea', value);
    },

    async adjustRows() {
      await page.click('[data-test-subj="tablePaginationPopoverButton"]');
      await page.click('text="100 rows"');
      await page.waitForTimeout(3e3);
    },

    async createBasicHTTPMonitorDetails({
      name,
      url,
      apmServiceName,
      locations,
    }: {
      name: string;
      url: string;
      apmServiceName: string;
      locations: string[];
    }) {
      await this.selectMonitorType('syntheticsMonitorTypeHTTP');
      await this.createBasicMonitorDetails({ name, apmServiceName, locations });
      await this.fillByTestSubj('syntheticsMonitorConfigURL', url);
    },

    async createBasicTCPMonitorDetails({
      name,
      host,
      apmServiceName,
      locations,
    }: {
      name: string;
      host: string;
      apmServiceName: string;
      locations: string[];
    }) {
      await this.selectMonitorType('syntheticsMonitorTypeTCP');
      await this.createBasicMonitorDetails({ name, apmServiceName, locations });
      await this.fillByTestSubj('syntheticsMonitorConfigHost', host);
    },

    async createBasicICMPMonitorDetails({
      name,
      host,
      apmServiceName,
      locations,
    }: {
      name: string;
      host: string;
      apmServiceName: string;
      locations: string[];
    }) {
      await this.selectMonitorType('syntheticsMonitorTypeICMP');
      await this.createBasicMonitorDetails({ name, apmServiceName, locations });
      await this.fillByTestSubj('syntheticsMonitorConfigHost', host);
    },

    async createBasicBrowserMonitorDetails({
      name,
      inlineScript,
      recorderScript,
      apmServiceName,
      locations,
    }: {
      name: string;
      inlineScript?: string;
      recorderScript?: string;
      params?: string;
      username?: string;
      password?: string;
      apmServiceName: string;
      locations: string[];
    }) {
      await this.createBasicMonitorDetails({ name, apmServiceName, locations });
      if (inlineScript) {
        await this.clickByTestSubj('syntheticsSourceTab__inline');
        await this.fillCodeEditor(inlineScript);
        return;
      }
      if (recorderScript) {
        // Upload buffer from memory
        await page.setInputFiles('input[data-test-subj=syntheticsFleetScriptRecorderUploader]', {
          name: 'file.js',
          mimeType: 'text/javascript',
          buffer: Buffer.from(recorderScript),
        });
      }
    },

    async createBasicMonitorDetails({
      name,
      apmServiceName,
      locations,
    }: {
      name: string;
      apmServiceName: string;
      locations: string[];
    }) {
      await page.click('text="Advanced options"');
      await this.fillByTestSubj('syntheticsMonitorConfigName', name);
      await this.fillByTestSubj('syntheticsMonitorConfigAPMServiceName', apmServiceName);
      await this.selectLocationsAddEdit({ locations });
    },

    async createMonitor({
      monitorConfig,
      monitorType,
    }: {
      monitorConfig: Record<string, string | string[]>;
      monitorType: FormMonitorType;
    }) {
      switch (monitorType) {
        case FormMonitorType.HTTP:
          // @ts-ignore
          await this.createBasicHTTPMonitorDetails(monitorConfig);
          break;
        case FormMonitorType.TCP:
          // @ts-ignore
          await this.createBasicTCPMonitorDetails(monitorConfig);
          break;
        case FormMonitorType.ICMP:
          // @ts-ignore
          await this.createBasicICMPMonitorDetails(monitorConfig);
          break;
        case FormMonitorType.MULTISTEP:
          // @ts-ignore
          await this.createBasicBrowserMonitorDetails(monitorConfig);
          break;
        default:
          break;
      }
    },

    async enableMonitorManagement(shouldEnable: boolean = true) {
      const isEnabled = await this.checkIsEnabled();
      if (isEnabled === shouldEnable) {
        return;
      }
      const [toggle, button] = await Promise.all([
        page.$(this.byTestId('syntheticsEnableSwitch')),
        page.$(this.byTestId('syntheticsEnableButton')),
      ]);

      if (toggle === null && button === null) {
        return null;
      }
      if (toggle) {
        if (isEnabled !== shouldEnable) {
          await toggle.click();
        }
      } else {
        await button?.click();
      }
    },

    async checkIsEnabled() {
      await page.waitForTimeout(5 * 1000);
      const addMonitorBtn = await this.getAddMonitorButton();
      const isDisabled = await addMonitorBtn.isDisabled();
      return !isDisabled;
    },

    async goToRulesPage() {
      const rulesPage = '/app/observability/alerts/rules';
      await page.goto(basePath + rulesPage);
    },
  };
}
