import axios from 'axios'
import { MessageBox, Message } from 'element-ui'
import { getToken, getLocalStorage, getObjectType } from 'utils-cs'

let VUE, NAMESPACE, TOKEN_KEY = 'AuthAPIToken', MICRO_PROXY = []
let FN_ERROR, FN_EXPIRE

const getMicroService = (url) => {
  let microServices = MICRO_PROXY
  let service = null
  if (url) {
    let regex = /\/[a-zA-Z]*/g
    let apis = url.match(regex)
    if (apis && apis.length > 0) {
      let api = apis[0]
      microServices.forEach(_service => {
        if (_service.proxy.includes(api)) {
          service = _service
        }
      })
    }
  }
  return service
}

const service = axios.create({
  timeout: 10000
})

const getResponseResult = (response) => {
  let Service = getMicroService(response.config.url)
  const res = response.data
  // 兼容第三方微服务
  let code = res[Service.code]
  let msg = ''
  let msgObj = res[Service.msg]
  if (typeof msgObj === 'object') {
    let msgKeys = Object.keys(msgObj)
    let msgArr = []
    msgKeys.forEach(key => {
      msgArr.push(msgObj[key])
    })
    msg = msgArr.join('；')
  } else {
    msg = msgObj
  }
  return {
    code: code === Service.tokenInvalid ? 401 : code,
    msg: msg,
    data: res
  }
}

// request interceptor
service.interceptors.request.use(
  config => {
    let microServices = getMicroService(config.url)
    if (microServices) {
      config.headers[microServices.token] = microServices.tokenPrefix + getToken(`${NAMESPACE ? NAMESPACE.toUpperCase() + ':' : ''}${TOKEN_KEY}`)
    }
    // 灰度用户标记
    const endUser = getLocalStorage('END_USER')
    if (endUser) {
      config.headers['end-user'] = 'canary'
    }
    // 防止缓存，GET请求默认带_t参数
    if (config.method === 'get') {
      config.params = {
        ...config.params,
        ...{
          _t: new Date().getTime()
        }
      }
    }
    return config
  },
  error => {
    return Promise.reject(error)
  }
)

service.interceptors.response.use(
  response => {
    let res = getResponseResult(response)
    if (res.code === 401) {
      if (FN_EXPIRE) {
        FN_EXPIRE()
      } else {
        MessageBox.alert(
          '您的登录状态已失效，请重新登录',
          '系统提示',
          {
            confirmButtonText: '重新登录'
          }
        ).then(() => {
          VUE.prototype.$logout()
        })
      }
    } else if (res.code !== 200) {
      if (FN_ERROR) {
        FN_ERROR()
      } else {
        Message({
          message: res.msg || 'Error',
          type: 'error',
          duration: 5 * 1000
        })
      }
      return Promise.reject(new Error(res.msg || 'Error'))
    } else {
      return res.data
    }
  },
  error => {
    Message({
      message: error.message.includes('网络超时') ? '' : error.message,
      type: 'error',
      duration: 5 * 1000
    })
    return Promise.reject(error)
  }
)

export function download (url, params) {
  let microServices = getMicroService(url)
  let headers = {}
  if (microServices) {
    headers[microServices.token] = microServices.tokenPrefix + getToken(`${NAMESPACE ? NAMESPACE.toUpperCase() + ':' : ''}${TOKEN_KEY}`)
  }
  // 灰度用户标记
  const endUser = getLocalStorage('END_USER')
  if (endUser) {
    headers['end-user'] = 'canary'
  }
  axios({
    url: url,
    method: 'get',
    params: {
      ...params,
      token: getToken(`${NAMESPACE ? NAMESPACE.toUpperCase() + ':' : ''}${TOKEN_KEY}`)
    },
    responseType: 'blob',
    headers: headers
  }).then(response => {
    let isBlob = getObjectType(response.data) === 'Blob'
    if (!isBlob) {
      let res = getResponseResult(response)
      Message({
        message: res.msg || 'Error',
        type: 'error',
        duration: 5 * 1000
      })
      return false
    }
    let filename = ''
    if (url.startsWith('http')) {
      let arr = url.split('/')
      filename = window.decodeURIComponent(arr[arr.length - 1])
    } else {
      let disposition = response.headers['content-disposition']
      let regex = /(?<=filename\*=UTF-8'').*$/
      let matchResult = disposition.match(regex)
      filename = window.decodeURIComponent(matchResult ? matchResult[0] : '')
    }
    let blob = response.data
    if (window.navigator.msSaveOrOpenBlob) {
      window.navigator.msSaveBlob(blob, filename)
    } else {
      const link = document.createElement('a')
      const evt = document.createEvent('HTMLEvents')
      evt.initEvent('click', false, false)
      link.href = window.URL.createObjectURL(blob)
      link.download = filename
      link.style.display = 'none'
      document.body.appendChild(link)
      link.click()
      window.URL.revokeObjectURL(link.href)
      document.body.removeChild(link)
    }
  }).catch(() => {
  })
}

export const request = service

const Request = {
  install (Vue, opts = {}) {
    VUE = Vue
    let { namespace, tokenKey, proxy, error, expire } = opts
    NAMESPACE = namespace || ''
    TOKEN_KEY = tokenKey || TOKEN_KEY
    MICRO_PROXY = proxy || MICRO_PROXY
    FN_ERROR = error || FN_ERROR
    FN_EXPIRE = expire || FN_EXPIRE
    Vue.prototype.$request = service
    Vue.prototype.$download = download
  }
}

if (typeof window !== 'undefined' && window.Vue) {
  window.request = Request
}

export default Request
