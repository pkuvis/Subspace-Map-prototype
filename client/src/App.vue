<template>
  <div id="app">
    <Main></Main>
  </div>
</template>
<script>
import Main from '@/components/Main'
export default {
  name: 'App',
  components: {
    Main
  },
  methods: {},
  mounted() {}
}

</script>
<style>
body {
  margin: 0
}

#app {
  /* font-family: 'Avenir', Helvetica, Arial, sans-serif; */
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-align: center;
  position: absolute;
  width: 100%;
  height: 100%;
}

</style>
