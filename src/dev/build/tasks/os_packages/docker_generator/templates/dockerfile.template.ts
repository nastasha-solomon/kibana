/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';
import Mustache from 'mustache';

import { TemplateContext } from '../template_context';

function generator(options: TemplateContext) {
  const dir = options.ironbank ? 'ironbank' : 'base';
  const template = readFileSync(resolve(__dirname, dir, './Dockerfile'));
  return Mustache.render(template.toString(), {
    wolfi: options.baseImage === 'wolfi',
    ubi: options.baseImage === 'ubi',
    ...options,
  });
}

export const dockerfileTemplate = {
  name: 'Dockerfile',
  generator,
};
