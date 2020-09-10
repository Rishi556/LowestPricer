let axios = require("axios")
let hive = require("@hiveio/hive-js")

let rpcAPI = "https://api.hive-engine.com/rpc/contracts"
let markets = ["STARBITS", "SIM", "BEER", "HUSTLER", "LEO", "LIST"]
let username = "nftmart.fees"
let privateActiveKey = ""

getOrders()

setInterval(() => {
  getOrders()
}, 1000 * 5 * 60)


async function getOrders() {
  for (i in markets) {
    let token = markets[i]
    let sellOrderQuery = { id: 0, jsonrpc: "2.0", method: "find", params: { contract: "market", table: "sellBook", query: { account: username, symbol: markets[i] }, limit: 1000, offset: 0, indexes: [{ index: "_id", descending: true }] } };
    let resMetrics = await axios.post(rpcAPI, sellOrderQuery)
    let sell = [];
    for (i in resMetrics.data.result) {
      sell.push(resMetrics.data.result[i].txId)
    }
    let c = 1;
    for (i in sell) {
      cancelOrder("sell", sell[i], c)
      c++
    }
    setTimeout(() => {
      placeOrders(token)
    }, 10 * 1000 * markets.length)
  }
}



function cancelOrder(type, id, count) {
  setTimeout(() => {
    let cancelJson = { "contractName": "market", "contractAction": "cancel", "contractPayload": { "type": `${type}`, "id": `${id}` } };
    console.log(`Attempting to cancel ${type} order with id ${id}.`);
    hive.broadcast.customJson(privateActiveKey, [username], null, "ssc-mainnet-hive", JSON.stringify(cancelJson), (err) => {
      if (err) {
        console.log(`Error canceling order with id ${id}.`)
      } else {
        console.log(`Successfully canceled order with id ${id}.`)
      }
    })
  }, count * 4000)
}

function placeOrders(token) {
  getBalances(token, (bal) => {
    if (bal > 0) {
      getPrice(token, (price) => {
        console.log(`Attempting to place order to sell ${bal} of ${token} at ${(price - 0.00000001).toFixed(8)}.`)
        let orderJSON = {"contractName":"market","contractAction": `sell`,"contractPayload":{"symbol": `${token}` ,"quantity": `${bal}`, "price": `${(price - 0.00000001).toFixed(8)}`}}
        hive.broadcast.customJson(privateActiveKey, [username], null, "ssc-mainnet-hive", JSON.stringify(orderJSON), (err, result) => {
          if (err) {
            console.log(`Error placing that order.`)
          } else {
            console.log(`Successfully placed the order. If it sells, we'll get ${(bal * (price - 0.00000001)).toFixed(3)} HIVE.`)
          }
        })
      })
    }
  })
}



function getBalances(symbol, callback) {
  let getBalancesQuery = { id: 0, jsonrpc: "2.0", method: "find", params: { contract: "tokens", table: "balances", query: { account: username, symbol: symbol }, limit: 1000, offset: 0, indexes: [] } }
  axios.post(rpcAPI, getBalancesQuery).then((res) => {
    if (res.data.result){
      let balance = parseFloat(res.data.result[0].balance)
      callback(balance)
    } else {
      callback(0)
    }
  })
}

function getPrice(token, callback) {
  let metricsQuery = { id: 0, jsonrpc: "2.0", method: "findOne", params: { contract: "market", table: "metrics", query: { symbol: token }, limit: 1000, offset: 0, indexes: [] } };
  axios.post(rpcAPI, metricsQuery).then((resMetrics) => {
    let data = resMetrics.data.result;
    let lowestAsk = parseFloat(data.lowestAsk);
    callback(lowestAsk)
  })
}