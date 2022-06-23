// Docs on event and context https://www.netlify.com/docs/functions/#the-handler-method
import fetch from 'node-fetch'

const handler = async (event) => {
  try {
    const headers = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE'
    };



    const phone = event.queryStringParameters.phone || 'xxxx'
    const email = event.queryStringParameters.email || 'xxxx'

    const options = {
      method: 'POST',
      headers: {Accept: 'application/json', 'Content-Type': 'application/json'},
      body: JSON.stringify({
        profiles: [{email: email}, {phone_number: phone, sms_consent: true}]
      })
    };
    const response = await fetch(`https://a.klaviyo.com/api/v2/list/Wiw2cn/subscribe?api_key=${process.env.PRIVATE_KEY}`, options)
    const data = await response.json()
    console.log(response)
    console.log(`\n`)
    console.log(data)
    if (data?.detail) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({res: data.detail})
      }
    } else {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({res: "success"})
      }

    }
  } catch (error) {
    return { statusCode: 500, body: error.toString() }
  }
}

module.exports = { handler }
