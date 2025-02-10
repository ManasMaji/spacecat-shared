/*
 * Copyright 2024 Adobe. All rights reserved.
 * This file is licensed to you under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License. You may obtain a copy
 * of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under
 * the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
 * OF ANY KIND, either express or implied. See the License for the specific language
 * governing permissions and limitations under the License.
 */
import { isObject } from '@adobe/spacecat-shared-utils';

import NotAuthenticatedError from './errors/not-authenticated.js';

/**
 * Authentication manager. It will try to authenticate the request with all the provided handlers.
 * If none of the handlers are able to authenticate the request, it will throw
 * a NotAuthenticatedError.
 * @class
 */
export default class AuthenticationManager {
  constructor(log) {
    this.log = log;
    this.handlers = [];
  }

  /**
   * Register a handler. This method is private and should not be called directly.
   * The handlers are used in the order they are registered.
   * @param {AbstractHandler} Handler - The handler to be registered
   */
  #registerHandler(Handler) {
    this.handlers.push(new Handler(this.log));
  }

  // eslint-disable-next-line class-methods-use-this
  async getAcls(authInfo) {
    console.log('§§§ Profile email:', authInfo.profile?.email);
  }

  /**
   * Authenticate the request with all the handlers.
   * @param {Object} request - The request object
   * @param {UniversalContext} context - The context object
   * @return {Promise<AuthInfo>} The authentication info
   * @throws {NotAuthenticatedError} If no handler was able to authenticate the request
   */
  async authenticate(request, context) {
    for (const handler of this.handlers) {
      this.log.debug(`Trying to authenticate with ${handler.name}`);

      let authInfo;
      try {
        // eslint-disable-next-line no-await-in-loop
        authInfo = await handler.checkAuth(request, context);
      } catch (error) {
        this.log.error(`Failed to authenticate with ${handler.name}:`, error);
      }

      if (isObject(authInfo)) {
        this.log.info(`Authenticated with ${handler.name}`);

        // eslint-disable-next-line no-await-in-loop
        const acls = await this.getAcls(authInfo);
        console.log('§§§ acls:', acls);

        context.attributes = context.attributes || {};

        // The acls are looked up per role
        authInfo.aclEntities = {
          model: ['organization'],
        };
        authInfo.acls = [
          {
            role: 'org-viewer',
            acl: [
              { path: '/organization/49968537-8983-45bb-b694-42d2013fec55', actions: [] },
              { path: '/organization/*', actions: ['R'] },
            ],
          },
          {
            role: 'cust1-editor',
            acl: [
              { path: '/organization/0f8ff270-968e-4007-aea1-2fa1c5e3332c', actions: ['C', 'R', 'U', 'D'] }, // july11
            ],
          },
        ];
        context.attributes.authInfo = authInfo;
        console.log('§§§ Set context.attributes.authInfo to:', authInfo);

        return authInfo;
      } else {
        this.log.debug(`Failed to authenticate with ${handler.name}`);
      }
    }

    this.log.info('No authentication handler was able to authenticate the request');
    throw new NotAuthenticatedError();
  }

  /**
   * Create an instance of AuthenticationManager.
   * @param {Array<AbstractHandler>} handlers - The handlers to be used for authentication
   * @param {Object} log - The log object
   * @return {AuthenticationManager} The authentication manager
   */
  static create(handlers, log) {
    const manager = new AuthenticationManager(log);

    if (!Array.isArray(handlers)) {
      throw new Error('Invalid handlers');
    }

    if (!handlers.length) {
      throw new Error('No handlers provided');
    }

    handlers.forEach((handler) => {
      manager.#registerHandler(handler);
    });

    return manager;
  }
}
