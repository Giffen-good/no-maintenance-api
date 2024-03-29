// Docs on event and context https://www.netlify.com/docs/functions/#the-handler-method
const faunadb = require("faunadb");
const {default: axios} = require("axios");
const handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE'
  };
  try {
    const {token, id, data} = JSON.parse(event.body)

    const user = await getFaunaUserByToken(token);
    if (!user) throw "Error: Document not found."

    const customerId = await getCustomerId(user)

    // extra validation
    if (Number(id) !== customerId) throw "Error: User ID Mismatch";

    await updateCustomerAccount(customerId, data)

    return {
      statusCode: 200,
      headers
    }
  } catch (error) {
    return { statusCode: 500, body: error.toString() }
  }
}

const getCustomerId = async (email) => {
  const url = `https://${process.env.SHOP_DOMAIN}/admin/api/2022-04/customers/search.json?query=email:${email}`;
  const options = {
    method: 'GET',
    url,
    headers: {Accept: 'application/json', 'Content-Type': 'application/json', 'X-Shopify-Access-Token': `${process.env.SHOP_ACCESS_TOKEN}`}
  };
  const customerId = await axios(options).then((res) => res.data.customers[0].id)
    .catch((err) => {
      console.error(err)
      throw err;
    })
  return customerId
}

const updateCustomerAccount = async (id, d) => {
  console.log('Update Customer Account')
  const {first_name, last_name, accepts_marketing, email} = d

  const query =  `mutation customerUpdate {
      customerUpdate(input: {
          id: "gid://shopify/Customer/${id}",
          firstName: "${first_name}",
          lastName: "${last_name}",
          emailMarketingConsent: "${accepts_marketing}",
          email: "${email}"
      }) {
        userErrors { 
          field 
          message 
        }
        customer {
          id
          firstName
          lastName
          emailMarketingConsent
          email
        }
      }
    }`
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
  const { data } = response;

  console.log(data)
  if (data.errors) throw "ERROR: Customer account could not be updated"

}


const getFaunaUserByToken = async (token) => {
  console.log('getFaunaUserByToken')
  const q = faunadb.query
  const client = new faunadb.Client({
    secret: process.env.FAUNADB_ADMIN_SECRET
  })
  return await client.query(
    q.Get(
      q.Match(
        q.Index('username_by_access_token'),
        token
      )
    )
  ).then((ret) => ret.data.username)
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
module.exports = { handler }
