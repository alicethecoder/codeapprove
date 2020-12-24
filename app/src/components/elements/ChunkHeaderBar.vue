<template>
  <div
    class="w-full py-1 px-2 flex items-center text-blue-500 border-b border-t border-blue-500"
  >
    <pre class="inline">{{ text }}</pre>
    <span class="flex-grow"></span>
    <a v-if="showAbove" @click.stop="expandAbove"
      ><code class="ml-2">+earlier</code></a
    >
  </div>
</template>

<script lang="ts">
import { Component, Vue, Prop } from "vue-property-decorator";
import { ChunkHeader } from "../../plugins/diff";
import * as parseDiff from "parse-diff";

@Component
export default class ChunkHeaderBar extends Vue {
  @Prop() prev!: parseDiff.Chunk;
  @Prop() chunk!: parseDiff.Chunk;

  get text() {
    let leftText = "none";
    if (this.chunk.oldStart > 1) {
      const leftStart = this.prev.oldStart + this.prev.oldLines;
      const leftEnd = this.chunk.oldStart - 1;

      leftText = `${leftStart}-${leftEnd}`;
    }

    let rightText = "none";
    if (this.chunk.newStart > 1) {
      const rightStart = this.prev.newStart + this.prev.newLines;
      const rightEnd = this.chunk.newStart - 1;
      rightText = `${rightStart}-${rightEnd}`;
    }

    return `> hidden: ${leftText}, ${rightText}`;
  }

  get showAbove() {
    return this.chunk.oldStart > 1 && this.chunk.newStart > 1;
  }

  public expandAbove() {
    this.$emit("expand-above");
  }
}
</script>

<style scoped lang="postcss">
a {
  @apply cursor-pointer;
}

a:hover {
  @apply underline text-blue-400;
}
</style>
