/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

import type { ZodType } from '@kbn/zod';
import { schema, Type } from '@kbn/config-schema';
import type { CoreVersionedRouter, Router } from '@kbn/core-http-router-server-internal';
import type { RouterRoute, VersionedRouterRoute } from '@kbn/core-http-server';
import { createLargeSchema } from './oas_converter/kbn_config_schema/lib.test.util';

type RoutesMeta = ReturnType<Router['getRoutes']>[number];
type VersionedRoutesMeta = ReturnType<CoreVersionedRouter['getRoutes']>[number];
type RuntimeSchema = Type<unknown> | ZodType<unknown>;

export const createRouter = (args: { routes: RoutesMeta[] }) => {
  return {
    getRoutes: () => args.routes,
  } as unknown as Router;
};
export const createVersionedRouter = (args: { routes: VersionedRoutesMeta[] }) => {
  return {
    getRoutes: () => args.routes,
  } as unknown as CoreVersionedRouter;
};

export const getRouterDefaults = (bodySchema?: RuntimeSchema): RouterRoute => ({
  isVersioned: false,
  path: '/foo/{id}/{path*}',
  method: 'get',
  options: {
    tags: ['foo', 'oas-tag:bar'],
    summary: 'route summary',
    description: 'route description',
    access: 'public',
  },
  validationSchemas: {
    request: {
      params: schema.object({
        id: schema.string({ maxLength: 36, meta: { description: 'id' } }),
        path: schema.string({ maxLength: 36, meta: { description: 'path' } }),
      }),
      query: schema.object({
        page: schema.number({ max: 999, min: 1, defaultValue: 1, meta: { description: 'page' } }),
      }),
      body: bodySchema ?? createLargeSchema(),
    },
    response: {
      200: {
        body: () => schema.string({ maxLength: 10, minLength: 1 }),
      },
      unsafe: { body: true },
    },
  },
  handler: jest.fn(),
});

export const getVersionedRouterDefaults = (bodySchema?: RuntimeSchema): VersionedRouterRoute => ({
  method: 'get',
  path: '/bar',
  options: {
    summary: 'versioned route',
    access: 'public',
    discontinued: 'route discontinued version or date',
    options: {
      tags: ['ignore-me', 'oas-tag:versioned'],
    },
    security: {
      authz: {
        requiredPrivileges: ['foo'],
      },
    },
  },
  isVersioned: true,
  handlers: [
    {
      fn: jest.fn(),
      options: {
        options: {
          deprecated: {
            documentationUrl: 'https://fake-url',
            reason: { type: 'remove' },
            severity: 'critical',
          },
        },
        validate: {
          request: {
            body:
              bodySchema ??
              schema.object({
                foo: schema.string(),
                deprecatedFoo: schema.maybe(
                  schema.string({
                    meta: {
                      description: 'deprecated foo',
                      deprecated: true,
                      'x-discontinued': 'route discontinued version or date',
                    },
                  })
                ),
              }),
          },
          response: {
            [200]: {
              description: 'OK response 2023-10-31',
              body: () =>
                schema.object(
                  { fooResponseWithDescription: schema.string() },
                  { meta: { description: 'fooResponse' } }
                ),
            },
          },
        },
        version: '2023-10-31',
      },
    },
    {
      fn: jest.fn(),
      options: {
        validate: {
          request: { body: schema.object({ foo: schema.string() }) },
          response: {
            [200]: {
              description: 'OK response 9999-99-99',
              body: () => schema.stream({ meta: { description: 'stream response' } }),
              bodyContentType: 'application/octet-stream',
            },
            unsafe: { body: true },
          },
        },
        version: '9999-99-99',
      },
    },
  ],
});

export interface CreateTestRouterArgs {
  routers?: { [routerId: string]: { routes: Array<Partial<RoutesMeta>> } };
  versionedRouters?: {
    [routerId: string]: { routes: Array<Partial<VersionedRoutesMeta>> };
  };
  bodySchema?: RuntimeSchema;
}

export const createTestRouters = (
  { routers = {}, versionedRouters = {}, bodySchema }: CreateTestRouterArgs = {
    routers: { testRouter: { routes: [{}] } },
    versionedRouters: { testVersionedRouter: { routes: [{}] } },
  }
): [routers: Router[], versionedRouters: CoreVersionedRouter[]] => {
  return [
    [
      ...Object.values(routers).map((rs) =>
        createRouter({
          routes: rs.routes.map((r) => Object.assign(getRouterDefaults(bodySchema), r)),
        })
      ),
    ],
    [
      ...Object.values(versionedRouters).map((rs) =>
        createVersionedRouter({
          routes: rs.routes.map((r) => Object.assign(getVersionedRouterDefaults(bodySchema), r)),
        })
      ),
    ],
  ];
};
