// /* eslint-disable -- for external use */
// /*
//  * Auth0 Rule (Rule No: 2) Enabled
//  *
//  * Verifies user email exists in our platform
//  *
//  * The following Settings must be configured in the rules dashboard:
//  *
//  * managementAppClientId - clientId of the machine 2 machine application defined to authorize with auth0 management api
//  * domain - api domain (mccaw | waystar | kandji)
//  * audience - api audience for web api defined e.g. http://xxx.mccaw.io/app/v1/
//  * auth0Domain - auth 0 custom domain for current tenant e.g. auth.mccaw.io
//  *
//  * Application metadata
//  *
//  * This rule is skipped for any application with the following Application metadata applied:
//  * {"integration": "true"}
//  */
// async function (user, context, callback) {

//   // External Deps
//   const axios = require('axios@0.19.2');
//   const url = require('url');

//   // Utility Fn
//   const getSubdomain = (hostname) => {
//     const [subdomain] = hostname
//       .split('.')
//       .filter((str) => str !== 'www');
//     return subdomain;
//   };

//   const updateUserAppMetaData = async (user_id, app_metadata) => {
//     try {
//       await auth0.users.updateAppMetadata(user_id, app_metadata);
//     } catch (e) {
//       // fail silently - we can try again next successful login
//     }
//   };

//   const createApiClient = (redirectUri) => {
//     const hostname = url.parse(redirectUri).hostname;
//     const subdomain = getSubdomain(hostname);
//     const domain = configuration.domain;
//     const baseURL = `https://${subdomain}.clients.us-1.${domain}.io`;
//     return [
//       axios.create({
//         baseURL,
//         headers: { "content-type": "application/json" },
//       }),
//       subdomain,
//       domain
//     ];
//   };

//   // ////////////////////////////////////////////////////////////////
//   // Rule: Verify user email exists in our platform
//   // ////////////////////////////////////////////////////////////////

//   const clientMetadata = context.clientMetadata || {};

//   // bypass this rule for integration applications
//   const isIntegrationApplication = clientMetadata.integration;
//   if (isIntegrationApplication) {
//     return callback(null, user, context);
//   }

//   // bypass this rule for all ADE SSO enrollment clients
//   const clientName = context.clientName || "";
//   if (clientMetadata.type && clientMetadata.type === "enrollment" && clientName.substr(-4, 4) === "-ade") {
//     return callback(null, user, context);
//   }

//   // inital access token request - request.query is populated
//   // refresh token request - request.body is populated
//   const redirect_uri = context.request.body.redirect_uri || context.request.query.redirect_uri;
//   const [apiClient, subdomain, domain] = createApiClient(redirect_uri);

//   // add user email and tenant as custom claims on the access token
//   // this allows us to look up the user in our platform after authorizing the access token
//   context.accessToken[`${configuration.audience}claims/email`] = user.email;
//   context.accessToken[`${configuration.audience}claims/tenant`] = subdomain;

//   // add users connection id and connection name on the id token
//   // this allows us to look up their connection details when we have access to this token in our client app
//   context.idToken[`${configuration.audience}claims/connectionId`] = context.connectionID;
//   context.idToken[`${configuration.audience}claims/connectionName`] = context.connection;

//   // bypass this rule for all auth0 Management Api Apps (Machine 2 Machine)
//   if (configuration.managementAppClientId === context.clientID) {
//     return callback(null, user, context);
//   }

//   // bypass this rule for custom database connectors
//   if (context.connectionStrategy === "auth0") {
//     return callback(null, user, context);
//   }

//   if (!user.email) {
//     return callback(new UnauthorizedError('User Does Not Exist'));
//   }

//   user.app_metadata = user.app_metadata || {};
//   user.app_metadata.user_verified = user.app_metadata.user_verified || [];

//   // we have already verified the user from a previous login
//   if (user.app_metadata.user_verified.includes(subdomain)) {
//     return callback(null, user, context);
//   }

//   // verify if user email exists in our platform
//   try {

//     const options = {
//       method: "GET",
//       url: "/app/v1/auth/validateuser",
//       params: { email: user.email }
//     };

//     await apiClient(options);

//     // update user app_metadata so we can omit this verification for future logins
//     user.app_metadata.user_verified = [
//       ...user.app_metadata.user_verified,
//       subdomain,
//     ];
//     updateUserAppMetaData(user.user_id, user.app_metadata);

//     return callback(null, user, context);
//   } catch (err) {

//     // log user out of auth0
//     const logout = `https://${configuration.auth0Domain}/v2/logout?`;
//     const returnTo = `returnTo=https://${subdomain}.${domain}.io/signin&client_id=${context.clientID}`;
//     context.redirect = {
//       url: `${logout}${returnTo}`
//     };
//     return callback(null, user, context);
//   }
// }
