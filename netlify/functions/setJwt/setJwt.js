// Docs on event and context https://www.netlify.com/docs/functions/#the-handler-method
const axios = require('axios').default;
const faunadb = require('faunadb')
const handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE'
  };

  try {
    const username = event.queryStringParameters.username;
    const password = event.queryStringParameters.password;

    const storefrontToken = await getStorefrontToken(username, password);
    const dbRes = await getAndSetFaunaToken(username,storefrontToken)
    console.log(dbRes)

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ token: `${storefrontToken}` }),

      // // more keys you can return:
      // headers: { "headerName": "headerValue", ... },
      // isBase64Encoded: true,
    }
  } catch (error) {
    return { statusCode: 500, body: error.toString() }
  }
}

const getAndSetFaunaToken = async (username, token) => {
  const q = faunadb.query
  const client = new faunadb.Client({
    secret: process.env.FAUNADB_ADMIN_SECRET
  })
  const doc = await getTokenAndId(client, q, username);
  let dbWrite;
  if (!doc){
    dbWrite = await setToken(client,q,username,token);
  } else {
    if (token !== doc.data.accessToken) {
      dbWrite = await updateToken(client,q, token, doc.ref.id);
    } else {
      // no write required
      console.log("Document Match found in FaunaDB")
      dbWrite = true;
    }
  }
  return dbWrite

}

const updateToken =  async (client, q, token, id) => {
  console.log('update Token:', token, id)
  return await client.query(
    q.Update(
      q.Ref(q.Collection('user_jwt'), id),
      {
        data: {
          accessToken: token,
        },
      },
    )
  )
    .then((ret) => ret)
    .catch((err) => {
        console.error(
          'Error: [%s] %s: %s',
          err.name,
          err.message,
          err.errors()[0].description,
        )
        throw err;
      }
    )
}

const setToken = async (client, q, username, token) => {
  return await client.query(
    q.Create(
      q.Collection('user_jwt'),
      {
        data: {
          username: username,
          accessToken: token
        },
      },
    )
  )
    .then((ret) => console.log(ret))
    .catch((err) => console.error(
      'Error: [%s] %s: %s',
      err.name,
      err.message,
      err.errors()[0].description,
    ))
}
const getTokenAndId = async (client, q, username) => {
  // where res:
  //  if doc is found => {
  //   ref: Ref(Collection("user_jwt"), "337645698187002448"),
  //   ts: 1658262880410000,
  //   data: {
  //     username: 'chris.bosh@gmail.com',
  //     accessToken: 'e261b4443bda137405302aaaa2185a09'
  //   }
  // }
  //  if doc is not found => null
  const res = await client.query(
    q.Get(
      q.Match(
        q.Index('token_and_id_by_user'),
        username
      )
    )
  ).then((ret) => ret)
    .catch((err) => {
      console.error(
        'Error: [%s] %s: %s',
        err.name,
        err.message,
        err.errors()[0].description,
      )
      return null
    }
  )
  return res
}



const getStorefrontToken = async (username, password) => {
  const query = `
      mutation customerAccessTokenCreate {
        customerAccessTokenCreate(input: {
          email: "${username}",
          password: "${password}"
        }) {
          customerAccessToken {
            accessToken
            expiresAt
          }
          customerUserErrors {
            code
            field
            message
          }
        }
      }
    `
  const options = {
    method: 'POST',
    url: `https://${process.env.SHOP_DOMAIN}/api/2020-07/graphql.json`,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'X-Shopify-Storefront-Access-Token': `${process.env.STOREFRONT_ACCESS_TOKEN}`
    },
    data: {
      query: query
    }
  };
  const response = await axios(options)
  const { data } = response

  if (!data.data.customerAccessTokenCreate.customerAccessToken)
    throw "Error: Failed to retrieve access token"
  return data.data.customerAccessTokenCreate.customerAccessToken.accessToken;
}




module.exports = { handler }
