/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { mount } from 'enzyme';
import React from 'react';
import { MockedProvider } from 'react-apollo/test-utils';

import { waitFor } from '@testing-library/react';
import { TestProviders } from '../../../../common/mock/test_providers';
import { mockOpenTimelineQueryResults } from '../../../../common/mock/timeline_results';
import * as i18n from '../translations';

import { OpenTimelineModalButton } from './open_timeline_modal_button';

describe('OpenTimelineModalButton', () => {
  test('it renders the expected button text', async () => {
    const wrapper = mount(
      <TestProviders>
        <MockedProvider mocks={mockOpenTimelineQueryResults} addTypename={false}>
          <OpenTimelineModalButton onClick={jest.fn()} />
        </MockedProvider>
      </TestProviders>
    );

    await waitFor(() => {
      wrapper.update();

      expect(wrapper.find('[data-test-subj="open-timeline-button"]').first().text()).toEqual(
        i18n.OPEN_TIMELINE
      );
    });
  });

  describe('onClick prop', () => {
    test('it invokes onClick function provided as a prop when the button is clicked', async () => {
      const onClick = jest.fn();
      const wrapper = mount(
        <TestProviders>
          <MockedProvider mocks={mockOpenTimelineQueryResults} addTypename={false}>
            <OpenTimelineModalButton onClick={onClick} />
          </MockedProvider>
        </TestProviders>
      );

      await waitFor(() => {
        wrapper.find('[data-test-subj="open-timeline-button"]').first().simulate('click');

        wrapper.update();

        expect(onClick).toBeCalled();
      });
    });
  });
});
