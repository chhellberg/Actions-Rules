exports.onExecutePostLogin = async (event, api) => {
  //External Deps
  const axios = require("axios@0.19.2");
  const url = require("url");

  //Utility Function
  const getSubdomain = (hostname) => {
    const [subdomain] = hostname.split(".").filter((str) => str !== "www");
    return subdomain;
  };

  const updateUserAppMetaData = async (user_id, app_metadata) => {
    try {
      await auth0.event.user.updateAppMetadata(user_id, app_metadata);
    } catch (e) {
      //fail silently - we can try again next
    }
  };

  const createApiClient = (redirectUri) => {
    const hostname = url.parse(redirectUri).hostname;
    const subdomain = getSubdomain(hostname);
    const domain = configuration.domain;
    const baseURL = `https://${subdomain}.clients.us-1.${domain}.io`;
    return [
      axios.create({
        baseURL,
        headers: { "content-type": "application/json" },
      }),
      subdomain,
      domain,
    ];
  };

  ////////////////////////////////////////////////////////////////
  // Rule: Verify user email exists in our platform
  // ////////////////////////////////////////////////////////////////

  const clientMetadata = event.user.user_metadata || {};
  const [apiClient, subdomain, domain] = createApiClient(redirect_uri);

  // bypass this rule for integration applications
  const isIntegrationApplication = clientMetadata.integration;
  if (isIntegrationApplication) {
    return;
  }
  // add user email and tenant as custom claims on the access token
  // this allows us to look up the user in our platform after authorizing the access token
  api.accessToken[`${configuration.audience}claims/email`] = event.user.email;
  api.accessToken[`${configuration.audience}claims/tenant`] = subdomain;

  // add users connection id and connection name on the id token
  // this allows us to look up their connection details when we have access to this token in our client app
  api.idToken[`${configuration.audience}claims/connectionId`] =
    event.user.connectionID;
  api.idToken[`${configuration.audience}claims/connectionName`] =
    event.user.connection;

  //verify if user email exists in our platform
  try {
    const options = {
      method: "GET",
      url: "/app/v1/auth/validateuser",
      params: { email: event.user.email },
    };

    await apiClient(options);

    // update user app_metadata so we can omit this verification for future logins
    event.user.app_metadata.user.user_verified = [
      ...event.user.app_metadata.user_verified,
      subdomain,
    ];
    updateUserAppMetaData(event.user.user_id, event.user.app_metadata);

    return;
  } catch (err) {
    // log user out of auth0
    const logout = `https://${configuration.auth0Domain}/v2/logout?`;
    const returnTo = `returnTo=https://${subdomain}.${domain}.io/signin&client_id=${event.client.client_id}`;
    api.redirect = {
      url: `${logout}${returnTo}`,
    };
    return;
  }
};
