<template>
  <div>
    <div class="grid grid-cols-1 lg:grid-cols-2 px-4 lg:px-16">
      <div
        class="inline-flex flex-col justify-center items-center px-4 py-4 md:py-8 lg:py-16 lg:px-16"
      >
        <h1 class="text-2xl md:text-4xl xl:text-6xl font-bold text-center">
          Faster, better code review <br class="lg:hidden" />for teams on GitHub
        </h1>

        <router-link to="/signin"
          ><button class="my-4 lg:my-8 btn btn-cta btn-purple self-center">
            Get Started
          </button></router-link
        >
      </div>

      <div class="flex-lg lg:p-16 lg:flex lg:flex-col lg:justify-center">
        <img src="@/assets/undraw_code_review_l1q9.svg" />
      </div>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-3 my-4 lg:my-8 px-4 lg:px-16">
      <div
        class="row-start-1 lg:col-start-1 col-span-2 lg:m-12 shadow dark-shadow border border-dark-0 rounded"
      >
        <img src="@/assets/hero.png" />
      </div>

      <div
        class="row-start-2 lg:row-start-1 lg:col-start-3 flex flex-col justify-center m-8 lg:m-12 text-center lg:text-left"
      >
        <h2 class="text-purple-300 text-xl md:text-3xl">
          <font-awesome-icon icon="keyboard" class="mr-3" />Fast
        </h2>
        <p class="text-lg md:text-2xl">
          Navigate files and leave comments with keyboard shortcuts.
        </p>
      </div>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-3 my-4 lg:my-8 px-4 lg:px-16">
      <div
        class="row-start-1 lg:col-start-2 col-span-2 lg:m-12 shadow dark-shadow border border-dark-0 rounded"
      >
        <img src="@/assets/hero.png" />
      </div>

      <div
        class="row-start-2 lg:row-start-1 flex flex-col justify-center m-8 lg:m-12 text-center lg:text-right lg:col-start-1"
      >
        <h2 class="text-purple-300 text-xl md:text-3xl">
          <font-awesome-icon icon="moon" class="mr-3" />Beautiful
        </h2>
        <p class="text-lg md:text-2xl">
          Crisp dark theme looks great next to your favorite editor.
        </p>
      </div>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-3 my-4 lg:my-8 px-4 lg:px-16">
      <div
        class="row-start-1 lg:col-start-1 col-span-2 lg:m-12 shadow dark-shadow border border-dark-0 rounded"
      >
        <img src="@/assets/hero.png" />
      </div>

      <div
        class="lg:col-start-3 row-start-2 lg:row-start-1 flex flex-col justify-center m-8 lg:m-12 text-center lg:text-left"
      >
        <h2 class="text-purple-300 text-xl md:text-3xl">
          <font-awesome-icon icon="tasks" class="mr-3" />Focused
        </h2>
        <p class="text-lg md:text-2xl">
          Easily track which threads are resolved and which are still pending.
        </p>
      </div>
    </div>

    <div class="flex flex-col items-center justify-center my-8">
      <span class="text-2xl lg:text-4xl mb-8">Ready to get started?</span>
      <router-link to="/signin"
        ><button class="btn btn-cta btn-purple mb-8">
          Sign Up Now
        </button></router-link
      >
    </div>
  </div>
</template>

<script lang="ts">
import { Component, Vue, Prop } from "vue-property-decorator";

@Component({
  components: {}
})
export default class Home extends Vue {
  async mounted() {}
}
</script>

<style lang="postcss">
.flex-lg {
  @apply hidden;
}

@screen lg {
  .flex-lg {
    display: flex;
  }
}
</style>
