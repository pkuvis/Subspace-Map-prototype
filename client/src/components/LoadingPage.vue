<template>
  <!-- <div id="loading-page" v-bind:class="{active: loadingFlag}"> -->
  <div id="loading-page">
    <div class="background"></div>
    <div class="loading-icon">
      <span>
        <i class="fa fa-spinner fa-spin" aria-hidden="true"></i>
      </span>
    </div>
  </div>
</template>

<script>
  // const d3 = require('d3')
  import { mapState } from 'vuex'

  export default {
    name: 'LoadingPage',
    data () {
      return {
        // loadingFlag: true
      }
    },
    mounted() {},
    computed: {
      // ...mapState(['loadingPage'])
    },
    watch: {}
  }
</script>

<style scoped lang="less">
  #loading-page {
    position: absolute;
    width: 100%;
    height: 100%;
    display: none;
    z-index: 1500;
    top: 0;
    display: block;

    .background{
      position: absolute;
      width: 100%;
      height: 100%;
      background-color: #ccc;
      opacity: 0.7;
    }

    .loading-icon{
      margin: auto;
      width: 3rem;
      height: 3rem;
      font-size: 3rem;
      position: absolute;
      top: 50%; left: 50%;
      transform: translate(-50%,-50%);
    }
  }
  // #loading-page.active{
  //   display: block;
  // }
</style>
