<template>
  <div
    class="flex items-center rounded bg-dark-3 border-dark-0 text-sm dark-shadow py-1 px-2"
  >
    <label for="select-base" class="mr-1 font-bold">{{ label }}:</label>
    <select
      id="select-base"
      class="bg-dark-4"
      v-model="selected"
      @change="onSelected($event.target.value)"
    >
      <option v-for="(key, index) in keys" :key="key" :value="key">{{
        values[index]
      }}</option>
    </select>
  </div>
</template>

<script lang="ts">
import { Component, Vue, Prop } from "vue-property-decorator";
import { LabeledSelectAPI } from "../api";

@Component
export default class LabeledSelect extends Vue implements LabeledSelectAPI {
  @Prop() label!: string;
  @Prop() keys!: string[];
  @Prop() values!: string[];

  public selected = this.keys[0];

  onSelected(key: string) {
    this.$emit("selected", { key });
  }

  setSelected(key?: string) {
    if (key) {
      this.selected = key;
    } else {
      this.selected = this.keys[0];
    }
  }
}
</script>

<style lang="postcss"></style>
