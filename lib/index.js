import axios from 'axios'
import { MessageBox, Message } from 'element-ui'
import { getToken, getLocalStorage, getObjectType } from 'utils-cs'

let VUE, NAMESPACE, TOKEN_KEY = 'AuthAPIToken'

const getMicroService = (url) => {
  const microServices = [
    {
      proxy: [
        process.env.VUE_APP_TEMPLATE_API, // 表单流程配置
        process.env.VUE_APP_FIELDSERVICE_API, // 现场服务交付
        process.env.VUE_APP_AUTHORITY_API, // 组织人员权限
        process.env.VUE_APP_PRODUCT_API, // 产品线
        process.env.VUE_APP_PARTMGT_API, // 备件
        process.env.VUE_APP_DATAQUERY_API, // 数据查询平台
        process.env.VUE_APP_QUARTZ_API, // 调度中心
        process.env.VUE_APP_KETTLE_API, // kettlemanager
        process.env.VUE_APP_MANAGED_SERVICE_API, // 运维工单
      ],
      token: 'AuthAPIToken',
      tokenPrefix: '',
      tokenInvalid: 401,
      msg: 'msg',
      code: 'code'
    },
    {
      proxy: [
        process.env.VUE_APP_MAGICCUBe_API, // 线上（魔方）
        process.env.VUE_APP_TENANTCENTER_API // 租户
      ],
      token: 'Authorization',
      tokenPrefix: 'Bearer ',
      tokenInvalid: 10010403,
      msg: 'message',
      code: 'statusCode'
    }
  ]
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
      MessageBox.alert(
        '您的登录状态已失效，请重新登录',
        '系统提示',
        {
          confirmButtonText: '重新登录'
        }
      ).then(() => {
        VUE.prototype.$logout(false)
      })
    } else if (res.code !== 200) {
      Message({
        message: res.msg || 'Error',
        type: 'error',
        duration: 5 * 1000
      })
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
    let { namespace, tokenKey } = opts
    NAMESPACE = namespace || ''
    TOKEN_KEY = tokenKey || TOKEN_KEY
    Vue.prototype.$request = service
    Vue.prototype.$download = download
  }
}

if (typeof window !== 'undefined' && window.Vue) {
  window.request = Request
}

export default Request
