# request-cs

> 服务云-Axios封装库。request中内置了download方法，用于文件下载。

### Install

``` bash
npm install request-cs --save
```

### Use

``` bash
1.全部引入
  import request from 'request-cs'
  Vue.use(request,{
    namespace: process.env.VUE_APP_NAME, // 命名空间名称
    tokenKey: 'tokenKey', // token的key值，非必填【默认值：AuthAPIToken】
    proxy：{
      proxy: [
        '/templateapi', // 表单流程配置
        '/fieldserviceapi' // 现场服务交付
      ],
      token: 'AuthAPIToken',
      tokenPrefix: '',
      tokenInvalid: 401,
      msg: 'msg',
      code: 'code'
    } // 微服务代理配置
  })
  使用：this.$request；this.$download
  
2.按需引入
  import { download, request } from 'utils-cs'
```
