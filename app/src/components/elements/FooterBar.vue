<template>
  <div class="footer py-4 px-8 bg-dark-2">
    <!-- Centered links -->
    <div
      class="below flex items-center justify-center dark-shadow text-purple-300 font-bold"
    >
      <router-link to="/pricing">
        <span class="footer-link">Pricing</span>
      </router-link>
      <span class="footer-link">About</span>
    </div>

    <!-- Right-aligned -->
    <div class="above text-white text-right">
      <span class="flex-grow"><!-- spacer --></span>
      <font-awesome-icon icon="keyboard" class="mr-2" />
      <span>Shortcuts: Alt + /</span>
    </div>
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

.footer {
  display: grid;
  grid-template: 1fr / 1fr;
}
.footer > * {
  grid-column: 1 / 1;
  grid-row: 1 / 1;
}
.footer .below {
  z-index: 2;
}
.footer .above {
  z-index: 1;
}
</style>
