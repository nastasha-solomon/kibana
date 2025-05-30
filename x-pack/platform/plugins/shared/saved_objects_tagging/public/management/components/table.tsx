/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import React, { FC, ReactNode } from 'react';
import {
  EuiInMemoryTable,
  EuiBasicTableColumn,
  EuiLink,
  Query,
  EuiIconTip,
  useEuiTheme,
} from '@elastic/eui';
import { i18n } from '@kbn/i18n';
import { FormattedMessage } from '@kbn/i18n-react';
import { TagsCapabilities } from '../../../common';
import type { TagWithRelations } from '../../../common/types';
import { TagBadge } from '../../components';
import { TagAction } from '../actions';

interface TagTableProps {
  loading: boolean;
  capabilities: TagsCapabilities;
  tags: TagWithRelations[];
  initialQuery?: Query;
  allowSelection: boolean;
  onQueryChange: (query?: Query) => void;
  selectedTags: TagWithRelations[];
  onSelectionChange: (selection: TagWithRelations[]) => void;
  getTagRelationUrl: (tag: TagWithRelations) => string;
  onShowRelations: (tag: TagWithRelations) => void;
  actions: TagAction[];
  actionBar: ReactNode;
}

const tablePagination = {
  initialPageSize: 20,
  pageSizeOptions: [5, 10, 20, 50],
};

const sorting = {
  sort: {
    field: 'name',
    direction: 'asc' as const,
  },
};

export const isModifiedOrPrevented = (event: React.MouseEvent) =>
  event.metaKey || event.altKey || event.ctrlKey || event.shiftKey || event.defaultPrevented;

export const TagTable: FC<TagTableProps> = ({
  loading,
  capabilities,
  tags,
  initialQuery,
  allowSelection,
  onQueryChange,
  selectedTags,
  onSelectionChange,
  onShowRelations,
  getTagRelationUrl,
  actionBar,
  actions,
}) => {
  const { euiTheme } = useEuiTheme();
  const connectionsLabel = i18n.translate(
    'xpack.savedObjectsTagging.management.table.columns.connections',
    {
      defaultMessage: 'Connections',
    }
  );
  const columns: Array<EuiBasicTableColumn<TagWithRelations>> = [
    {
      field: 'name',
      name: i18n.translate('xpack.savedObjectsTagging.management.table.columns.name', {
        defaultMessage: 'Name',
      }),
      sortable: (tag: TagWithRelations) => tag.name,
      'data-test-subj': 'tagsTableRowName',
      render: (name: string, tag: TagWithRelations) => {
        return (
          <>
            <TagBadge tag={tag} />
            {tag.managed && (
              <div css={{ marginLeft: euiTheme.size.s }}>
                <EuiIconTip
                  type="lock"
                  content={i18n.translate(
                    'xpack.savedObjectsTagging.management.table.managedTagTooltip',
                    {
                      defaultMessage:
                        'This {tagName} is managed by Elastic and cannot be deleted, edited, or assigned to objects.',
                      values: { tagName: tag.name },
                    }
                  )}
                />
              </div>
            )}
          </>
        );
      },
    },
    {
      field: 'description',
      name: i18n.translate('xpack.savedObjectsTagging.management.table.columns.description', {
        defaultMessage: 'Description',
      }),
      sortable: true,
      'data-test-subj': 'tagsTableRowDescription',
    },
    {
      field: 'relationCount',
      name: connectionsLabel,
      sortable: (tag: TagWithRelations) => tag.relationCount,
      'data-test-subj': 'tagsTableRowConnections',
      render: (relationCount: number, tag: TagWithRelations) => {
        if (relationCount < 1) {
          return undefined;
        }

        const columnText = (
          <span data-test-subj="tagsTableRowConnectionsText">
            <FormattedMessage
              id="xpack.savedObjectsTagging.management.table.content.connectionCount"
              defaultMessage="{relationCount, plural, one {1 saved object} other {# saved objects}}"
              values={{ relationCount }}
            />
          </span>
        );

        return capabilities.viewConnections ? (
          // eslint-disable-next-line @elastic/eui/href-or-on-click
          <EuiLink
            data-test-subj="tagsTableRowConnectionsLink"
            href={getTagRelationUrl(tag)}
            onClick={(e: React.MouseEvent) => {
              if (!isModifiedOrPrevented(e) && e.button === 0) {
                e.preventDefault();
                onShowRelations(tag);
              }
            }}
            aria-label={i18n.translate(
              'xpack.savedObjectsTagging.management.table.connectionsAriaLabel',
              {
                defaultMessage: `{connectionsLabel} of {tagName} tag`,
                values: { connectionsLabel, tagName: tag.name },
              }
            )}
          >
            {columnText}
          </EuiLink>
        ) : (
          columnText
        );
      },
    },
    ...(actions.length
      ? [
          {
            name: i18n.translate('xpack.savedObjectsTagging.management.table.columns.actions', {
              defaultMessage: 'Actions',
            }),
            width: '100px',
            actions,
          },
        ]
      : []),
  ];

  const testSubjectState = !loading ? 'table-is-ready' : 'table-is-loading';

  return (
    <EuiInMemoryTable
      data-test-subj={`tagsManagementTable ${testSubjectState}`}
      childrenBetween={actionBar}
      loading={loading}
      itemId={'id'}
      columns={columns}
      items={tags}
      pagination={tablePagination}
      sorting={sorting}
      tableCaption={i18n.translate('xpack.savedObjectsTagging.management.table.columns.caption', {
        defaultMessage: 'Tags',
      })}
      rowHeader="name"
      selection={
        allowSelection
          ? {
              selected: selectedTags,
              onSelectionChange,
              selectable: (tag: TagWithRelations) => !tag.managed,
              selectableMessage: (selectable) =>
                selectable
                  ? ''
                  : i18n.translate('xpack.savedObjectsTagging.management.table.managedMessage', {
                      defaultMessage:
                        'This tag is managed by Elastic and cannot be deleted or assigned to objects.',
                    }),
            }
          : undefined
      }
      search={{
        defaultQuery: initialQuery,
        onChange: ({ query }) => {
          onQueryChange(query || undefined);
        },
        box: {
          'data-test-subj': 'tagsManagementSearchBar',
          incremental: true,
          schema: {
            fields: {
              name: { type: 'string' },
              description: { type: 'string' },
            },
          },
        },
      }}
      rowProps={(item) => ({
        'data-test-subj': 'tagsTableRow',
      })}
    />
  );
};
