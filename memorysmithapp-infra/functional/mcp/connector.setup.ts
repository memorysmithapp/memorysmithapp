/**
 * Connects the suite to the connector the way a person connects an agent
 * (architecture-guide.md, section 13.3), once per run and before any MCP case.
 * The flow itself lives in `support/connector-flow.ts`, which the agent
 * evaluation runs too, as a client of its own.
 */

import { test as setup } from '@playwright/test';
import { connectThroughBrowser } from '../support/connector-flow.js';
import { writeConnectorToken } from '../support/connector-state.js';
import { readState } from '../support/state.js';

setup(
  'connects the suite to the connector through the whole OAuth flow, in a browser',
  async ({ page }) => {
    const state = readState();
    writeConnectorToken(
      await connectThroughBrowser({
        page,
        environment: state.environment,
        region: state.region,
        site: state.surfaces.site,
        mcp: state.surfaces.mcp,
        account: state.accounts.owner,
      }),
    );
  },
);
