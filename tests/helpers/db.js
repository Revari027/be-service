/**
 * Integration tests need a reachable MySQL database. They only run when
 * RUN_INTEGRATION_TESTS=true so a plain `npm test` never depends on one.
 */
const integrationEnabled = process.env.RUN_INTEGRATION_TESTS === 'true';

const describeIntegration = integrationEnabled ? describe : describe.skip;

async function loginAs(agent, { email, password }) {
  const response = await agent.post('/api/v1/auth/login').send({ email, password });

  if (response.status !== 200) {
    throw new Error(`Login failed with status ${response.status}`);
  }

  return response.body.data.csrf_token;
}

module.exports = {
  integrationEnabled,
  describeIntegration,
  loginAs,
};
