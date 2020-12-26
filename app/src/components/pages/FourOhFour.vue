<template>
  <div class="flex flex-col items-center text-center my-12">
    <h2 class="text-xl">
      Oops! The page you're looking for does not exist.
    </h2>
    <img class="mt-12" width="400" src="@/assets/undraw_online_test_gba7.svg" />
  </div>
</template>

<script lang="ts">
import { Component, Vue, Prop } from "vue-property-decorator";

@Component({
  components: {}
})
export default class FourOhFour extends Vue {
  async mounted() {}
}
</script>

<style lang="postcss"></style>
