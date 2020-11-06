let axios = require("axios")
let hive = require("@hiveio/hive-js")
let logger = require("node-color-log")

let rpcAPI = "https://api.hive-engine.com/rpc/contracts"
let markets = ["STARBITS", "SIM", "BEER", "HUSTLER", "LEO", "LIST"]
let username = "rishi556"
let privateActiveKey = ""

async function cancelAllOrders() {
  let sellOrderQuery = { id: 0, jsonrpc: "2.0", method: "find", params: { contract: "market", table: "sellBook", query: { account: username, symbol: { $in: markets } }, limit: 50, offset: 0, indexes: [{ index: "_id", descending: true }] } };
  let result = await axios.post(rpcAPI, sellOrderQuery)
  let orders = result.data.result
  if (orders.length === 0) {
    return true
  }
  let cancelJSON = []
  for (let i in orders) {
    cancelJSON.push({ "contractName": "market", "contractAction": "cancel", "contractPayload": { "type": "sell", "id": `${orders[i].txId}` } })
  }
  hive.broadcast.customJson(privateActiveKey, [username], null, "ssc-mainnet-hive", JSON.stringify(cancelJSON), (err) => {
    if (err){
      logger.error(`Error cancelling, recieved error : ${err}, JSON attempted to broadcst: ${JSON.stringify(cancelJSON)}.`)
      throw new Error(err)
    }
    setTimeout(() => {
      return cancelAllOrders()
    }, 1000 * 10)
  })
}

async function getBalances() {
  let getBalancesQuery = { id: 0, jsonrpc: "2.0", method: "find", params: { contract: "tokens", table: "balances", query: { account: username, symbol: { $in: markets } }, limit: 50, offset: 0, indexes: [] } }
  let result = await axios.post(rpcAPI, getBalancesQuery)
  let balances = result.data.result
  let nonZeroBalances = {}
  for (let i in balances){
    if (parseFloat(balances[i].balance) > 0){
      nonZeroBalances[balances[i].symbol] = balances[i].balance
    }
  }
  return nonZeroBalances
}

async function getPrices(tokens) {
  let metricsQuery = { id: 0, jsonrpc: "2.0", method: "find", params: { contract: "market", table: "metrics", query: { symbol: { $in: tokens } }, limit: 50, offset: 0, indexes: [] } };
  let result = await axios.post(rpcAPI, metricsQuery)
  let prices = result.data.result
  let validPrices = {}
  for (let i in prices){
    if (parseFloat(prices[i].lowestAsk) !== 0){
      validPrices[prices[i].symbol] = prices[i].lowestAsk
    }
  }
  return validPrices
}

function placeOrders(balances, prices){
  let orderJSON = []
  for (let i in balances){
    if (prices[i]){
      orderJSON.push({ "contractName": "market", "contractAction": `sell`, "contractPayload": { "symbol": i, "quantity": `${balances[i]}`, "price": `${(parseFloat(prices[i]) - 0.00000001).toFixed(8)}` } })
    }
  }
  if (orderJSON.length === 0){
    return
  }
  hive.broadcast.customJson(privateActiveKey, [username], null, "ssc-mainnet-hive", JSON.stringify(orderJSON), (err) => {
    if (err){
      logger.error(`Error placing order, recieved error : ${err}, JSON attempted to broadcst: ${JSON.stringify(orderJSON)}.`)
      throw new Error(err)
    }
  })
}

async function refresh(){
  await cancelAllOrders()
  let balances = await getBalances()
  let prices = await getPrices(Object.keys(balances))
  placeOrders(balances, prices)
}

refresh()
setInterval(() => {
  refresh()
}, 10 * 1000 * 5)
