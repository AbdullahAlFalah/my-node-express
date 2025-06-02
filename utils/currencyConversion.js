const axios = require('axios');

const API_KEY = process.env.EXCHANGERATE_API_KEY; 

async function convert(amount, from, to) {
  if (from === to) return amount;
  try {
    const url = `https://v6.exchangerate-api.com/v6/${API_KEY}/pair/${from}/${to}/${amount}`;
    const response = await axios.get(url);
    if (response.data && response.data.result === "success") {
      return response.data.conversion_result;
    } else if (response.data && response.data.result === "error") {
        throw new Error(`Conversion failed: ${response.data['error-type']}`);
    }
  } catch (err) {
    throw new Error('Currency conversion error');
  }
}

module.exports = convert;

