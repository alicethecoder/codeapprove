<template>
  <div class="mt-12">
    <h1 class="text-4xl text-center mb-6">
      Pricing
    </h1>

    <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
      <div
        v-for="p in plans"
        :key="p.name"
        class="text-center bg-dark-3 rounded-md overflow-hidden shadow dark-shadow border border-dark-0"
      >
        <h2 class="bg-dark-4 font-bold text-2xl text-center py-1">
          {{ p.name }}
        </h2>
        <div class="py-4 px-8">
          <div class="text-lg">
            {{ p.description }}
          </div>
          <div class=" text-purple-400">
            <span class="text-4xl">$</span
            ><span class="text-6xl">{{ p.price }}</span
            ><span>/ {{ p.unit }}</span>
          </div>
          <div class="text-sm">
            {{ p.subUnit }}
          </div>
          <button class="btn btn-purple mt-8 mb-4">Coming Soon</button>
        </div>
      </div>
    </div>

    <p class="mt-4 text-center">
      CodeApprove is currently free while in Alpha.<br />The pricing above is
      estimated future pricing.
    </p>
  </div>
</template>

<script lang="ts">
import { Component, Vue, Prop } from "vue-property-decorator";

@Component({
  components: {}
})
export default class Pricing extends Vue {
  plans = [
    {
      name: "Free",
      description:
        "Try CodeApprove on one open-source repository. Free forever, no credit card required.",
      price: 0,
      unit: "month",
      subUnit: "(free)"
    },
    {
      name: "Org",
      description:
        "Use CodeApprove on unlimited open-source repositories in a single org. Perfect for large open-source projects.",
      price: 49,
      unit: "org",
      subUnit: "(per month)"
    },
    {
      name: "Enterprise",
      description:
        "Use CodeApprove on unlimited open-source or private repositories across orgs. Best for large teams.",
      price: 19,
      unit: "user",
      subUnit: "(per month)"
    }
  ];

  async mounted() {}
}
</script>

<style lang="postcss"></style>
