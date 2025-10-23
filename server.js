require('dotenv').config();
const { ApolloServer } = require('@apollo/server');
const { startStandaloneServer } = require('@apollo/server/standalone');
const { GraphQLClient } = require('graphql-request');
const { GraphQLError } = require('graphql');
const OktaJwtVerifier = require('@okta/jwt-verifier');

// JWT validation configuration
const OKTA_AUDIENCE = process.env.OKTA_AUDIENCE || 'backend';
const REQUIRED_SCOPES = (process.env.REQUIRED_SCOPES || 'backend-api:read').split(' ');

// Initialize Okta JWT Verifier
const oktaJwtVerifier = new OktaJwtVerifier({
  issuer: process.env.OKTA_ISSUER,
  clientId: OKTA_AUDIENCE,
  assertClaims: {
    // Issuer and expiration are verified by default
  },
});

// Client to the external Countries API
const countriesClient = new GraphQLClient(
  'https://countries.trevorblades.com/'
);

// Your schema
const typeDefs = `
  type Country {
    code: String!
    name: String!
    capital: String
    currency: String
    emoji: String!
    continent: Continent!
  }

  type Continent {
    code: String!
    name: String!
  }

  type Query {
    country(code: String!): Country
    countries: [Country!]!

    # Custom endpoints!
    europeanCountries: [Country!]!
    countriesByContinent(continentCode: String!): [Country!]!
  }
`;

const resolvers = {
  Query: {
    // Simple proxy - forward the request
    country: async (_, { code }) => {
      const query = `
        query GetCountry($code: ID!) {
          country(code: $code) {
            code
            name
            capital
            currency
            emoji
            continent {
              code
              name
            }
          }
        }
      `;
      const data = await countriesClient.request(query, { code });
      return data.country;
    },

    countries: async () => {
      const query = `
        query {
          countries {
            code
            name
            capital
            currency
            emoji
            continent {
              code
              name
            }
          }
        }
      `;
      const data = await countriesClient.request(query);
      return data.countries;
    },

    // Custom endpoint - filter for European countries
    europeanCountries: async () => {
      const query = `
        query {
          countries {
            code
            name
            capital
            currency
            emoji
            continent {
              code
              name
            }
          }
        }
      `;
      const data = await countriesClient.request(query);
      return data.countries.filter(
        country => country.continent.code === 'EU'
      );
    },

    // Custom endpoint with parameter
    countriesByContinent: async (_, { continentCode }) => {
      const query = `
        query {
          countries {
            code
            name
            capital
            currency
            emoji
            continent {
              code
              name
            }
          }
        }
      `;
      const data = await countriesClient.request(query);
      return data.countries.filter(
        country => country.continent.code === continentCode
      );
    },
  },
};

const server = new ApolloServer({ typeDefs, resolvers });

startStandaloneServer(server, {
  context: async ({ req }) => {
    const requireAuth = process.env.REQUIRE_AUTH === 'true';

    // Extract the Bearer token from Authorization header
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      if (requireAuth) {
        throw new GraphQLError('Authentication required. Please provide a Bearer token.', {
          extensions: {
            code: 'UNAUTHENTICATED',
            http: { status: 401 },
          },
        });
      }

      console.log('Unauthenticated request (allowed)');
      return {
        user: null,
        authenticated: false
      };
    }

    const token = authHeader.replace('Bearer ', '');

    try {
      // Verify the JWT with Okta (validates audience, issuer, expiration)
      const jwt = await oktaJwtVerifier.verifyAccessToken(token, OKTA_AUDIENCE);

      // Validate required scopes
      const tokenScopes = jwt.claims.scp
        ? (Array.isArray(jwt.claims.scp) ? jwt.claims.scp : jwt.claims.scp.split(' '))
        : [];
      const hasRequiredScopes = REQUIRED_SCOPES.every(scope =>
        tokenScopes.includes(scope)
      );

      if (!hasRequiredScopes) {
        console.error('Missing required scopes. Required:', REQUIRED_SCOPES, 'Got:', tokenScopes);
        throw new GraphQLError('Insufficient permissions', {
          extensions: {
            code: 'FORBIDDEN',
            http: { status: 403 },
            required: REQUIRED_SCOPES,
            provided: tokenScopes,
          },
        });
      }

      console.log('Authenticated request');
      console.log('JWT Token Details:');
      console.log('   Subject (sub):', jwt.claims.sub);
      console.log('   Audience (aud):', jwt.claims.aud);
      console.log('   Scopes (scp):', jwt.claims.scp || 'N/A');
      console.log('   Issuer (iss):', jwt.claims.iss);
      console.log('   Issued At:', new Date(jwt.claims.iat * 1000).toISOString());
      console.log('   Expires At:', new Date(jwt.claims.exp * 1000).toISOString());
      console.log('   Client ID (cid):', jwt.claims.cid || 'N/A');
      console.log('   User ID (uid):', jwt.claims.uid || 'N/A');

      // Log all other claims
      const standardClaims = ['sub', 'aud', 'scp', 'iss', 'iat', 'exp', 'cid', 'uid'];
      const customClaims = Object.keys(jwt.claims).filter(key => !standardClaims.includes(key));
      if (customClaims.length > 0) {
        console.log('   Custom Claims:', JSON.stringify(
          Object.fromEntries(customClaims.map(key => [key, jwt.claims[key]])),
          null,
          2
        ));
      }

      // Return the verified JWT claims in context
      return {
        user: jwt.claims,
        authenticated: true,
        token
      };
    } catch (error) {
      // If it's already a GraphQLError (e.g., from scope validation), rethrow it
      if (error instanceof GraphQLError) {
        throw error;
      }

      console.error('Token verification failed:', error.message);
      throw new GraphQLError('Invalid or expired token', {
        extensions: {
          code: 'UNAUTHENTICATED',
          http: { status: 401 },
        },
      });
    }
  },
  listen: { port: parseInt(process.env.PORT) || 4000 },
}).then(({ url }) => {
  const requireAuth = process.env.REQUIRE_AUTH === 'true';
  console.log(`Proxy server ready at ${url}`);
  console.log(`Proxying to Countries API`);
  console.log(`Okta authentication: ${requireAuth ? 'REQUIRED' : 'OPTIONAL'}`);
  console.log(`   Issuer: ${process.env.OKTA_ISSUER}`);
  console.log(`   Required Audience: ${OKTA_AUDIENCE}`);
  console.log(`   Required Scopes: ${REQUIRED_SCOPES.join(' ')}`);
});
