<template>
  <div
    class="flex items-center justify-center dark-shadow text-purple-300 font-bold py-4 px-8 bg-dark-2"
  >
    <router-link to="/pricing">
      <span class="footer-link">Pricing</span>
    </router-link>
    <span class="footer-link">About</span>
  </div>
</template>

<script lang="ts">
import { Component, Vue, Prop } from "vue-property-decorator";

@Component
export default class FooterBar extends Vue {}
</script>

<style lang="postcss">
.footer-link {
  @apply mx-2 cursor-pointer;
}
</style>
