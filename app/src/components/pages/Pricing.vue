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
        <h2
          class="bg-dark-4 font-bold text-2xl shadow dark-shadow border-dark-0 text-center py-1"
        >
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

          <table class="w-3/4 mx-auto mt-4">
            <tr v-for="f in p.features" :key="f.text" class="text-left text-lg">
              <td>
                <font-awesome-icon
                  fixed-width
                  v-if="f.status === 'green'"
                  icon="check"
                  class="text-green-400 mr-2"
                />
                <font-awesome-icon
                  fixed-width
                  v-if="f.status === 'yellow'"
                  icon="minus"
                  class="text-yellow-400 mr-2"
                />
                <font-awesome-icon
                  fixed-width
                  v-if="f.status === 'red'"
                  icon="times"
                  class="text-red-400 mr-2"
                />
              </td>

              <td>{{ f.text }}</td>
            </tr>
          </table>

          <button class="btn btn-purple mt-8 mb-4">{{ p.cta }}</button>
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

interface Plan {
  name: string;
  description: string;
  price: number;
  unit: string;
  subUnit: string;
  cta: string;
  features: { text: string; status: "green" | "yellow" | "red" }[];
}

@Component({
  components: {}
})
export default class Pricing extends Vue {
  PLAN_FREE: Plan = {
    name: "Free",
    description:
      "Try CodeApprove on one public repository in your org. Free forever, no credit card required.",
    price: 0,
    unit: "repo",
    subUnit: "(free)",
    cta: "Sign Up",
    features: [
      { text: "Full CodeApprove experience", status: "green" },
      { text: "Unlimited collaborators", status: "green" },
      { text: "1 public repo", status: "yellow" },
      { text: "0 private repos", status: "red" }
    ]
  };

  PLAN_ORG: Plan = {
    name: "Pro",
    description:
      "Use CodeApprove on all your public repositories in a single org. Perfect for large open-source projects.",
    price: 29,
    unit: "org",
    subUnit: "(per month)",
    cta: "Coming Soon",
    features: [
      { text: "Full CodeApprove experience", status: "green" },
      { text: "Unlimited collaborators", status: "green" },
      { text: "Unlimited public repos", status: "green" },
      { text: "0 private repos", status: "red" }
    ]
  };

  PLAN_ENTERPRISE: Plan = {
    name: "Enterprise",
    description:
      "Use CodeApprove on unlimited public and private repositories. Best for large teams.",
    price: 7,
    unit: "user",
    subUnit: "(per month)",
    cta: "Coming Soon",
    features: [
      { text: "Full CodeApprove experience", status: "green" },
      { text: "Unlimited collaborators", status: "green" },
      { text: "Unlimited public repos", status: "green" },
      { text: "Unlimited private repos", status: "green" }
    ]
  };

  plans: Plan[] = [this.PLAN_FREE, this.PLAN_ORG, this.PLAN_ENTERPRISE];

  async mounted() {}
}
</script>

<style lang="postcss"></style>
