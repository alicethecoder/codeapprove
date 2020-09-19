<template>
  <div
    :class="{ active: active }"
    class="rounded overflow-hidden my-2 dark-shadow border border-dark-0"
  >
    <!-- Bind hotkeys when active -->
    <div v-if="active && expanded" v-hotkey="hotKeyMap" />

    <!-- Change header -->
    <div
      @click="toggle"
      class="flex p-2 font-bold items-center bg-dark-3 border-b border-dark-0"
    >
      <font-awesome-icon
        fixed-width
        :icon="icon"
        :class="{ invisible: isBinary }"
      />
      <span class="ml-2 text-wht-med">{{ title }}</span>
      <span
        class="text-sm text-purple-300 ml-4"
        v-if="countUnresolvedThreads > 0"
      >
        {{ countUnresolvedThreads }}
        <font-awesome-icon icon="comment" size="sm" />
      </span>
      <span class="flex-grow"><!-- spacer --></span>
      <span class="text-right text-sm text-white-md mr-2">
        <span v-if="isBinary">binary</span>
        <span v-else>{{ meta.additions + meta.deletions }}</span>
      </span>
      <div
        v-if="!isBinary"
        class="w-12 rounded overflow-hidden"
        style="line-height: 12px; height: 12px;"
      >
        <div
          class="inline-block bg-green-400"
          :style="`height: 12px; width: ${additionPct}%`"
        ></div>
        <div
          class="inline-block bg-red-400"
          :style="`height: 12px; width: ${100 - additionPct}%`"
        ></div>
      </div>
    </div>

    <!-- Placeholder while loading -->
    <div v-if="loading" class="text-lg text-center bg-dark-2 text-brt-dim p-4">
      <span v-if="tooBig"
        >This diff is too large to render, please view it locally.</span
      >
      <span v-else>Loading...</span>
    </div>

    <!-- Expanded Change -->
    <div
      v-else-if="loaded || expanded"
      v-show="expanded"
      class="bg-dark-4 overflow-hidden"
    >
      <template v-for="({ chunk, pairs }, i) in chunks">
        <ChunkHeaderBar
          v-show="showChunkHeader(i)"
          :key="chunk.content"
          :prev="getPrevChunk(i)"
          :chunk="chunk"
          @expand-above="loadLinesAbove(i)"
        />

        <DiffLine
          v-for="pair in pairs"
          ref="difflines"
          :key="
            `${chunk.content}-pair-${pair.left.number}-${pair.right.number}`
          "
          :rendered="pair"
          :langs="langPair"
          :threads="getThreads(pair)"
        />
      </template>
    </div>
  </div>
</template>

<script lang="ts">
import { Component, Prop, Vue, Mixins } from "vue-property-decorator";
import { getModule } from "vuex-module-decorators";
import parseDiff from "parse-diff";

import { ChangeEntryAPI, DiffLineAPI } from "../api";
import { EventEnhancer } from "../mixins/EventEnhancer";

import DiffLine from "@/components/elements/DiffLine.vue";
import ChunkHeaderBar from "@/components/elements/ChunkHeaderBar.vue";
import AuthModule from "../../store/modules/auth";
import ReviewModule from "../../store/modules/review";
import { AddCommentEvent } from "../../plugins/events";
import { nextRender, makeTopVisible } from "../../plugins/dom";
import { getFileLang } from "../../plugins/prism";

import { Github } from "../../../../shared/github";

import {
  ThreadPositionArgs,
  Thread,
  Side,
  ThreadPair,
  ThreadContentArgs
} from "../../model/review";
import {
  ChangePair,
  RenderedChangePair,
  FileMetadata,
  ChunkData,
  EMPTY_CHUNK,
  renderLoadedLineChange
} from "../../plugins/diff";
import { KeyMap, CHANGE_ENTRY_KEY_MAP } from "../../plugins/hotkeys";
import { freezeArray } from "../../../../shared/freeze";
import { isBinaryFile } from "../../plugins/binary";
import { config } from "../../plugins/config";

@Component({
  components: {
    DiffLine,
    ChunkHeaderBar
  }
})
export default class ChangeEntry extends Mixins(EventEnhancer)
  implements ChangeEntryAPI {
  @Prop() meta!: FileMetadata;
  @Prop() chunks!: ChunkData[];

  public active = false;
  public loading = false;
  public loaded = false;
  public expanded = false;

  public activeLineIndex = -1;

  private authModule = getModule(AuthModule, this.$store);
  private reviewModule = getModule(ReviewModule, this.$store);
  private github: Github = new Github(
    AuthModule.getDelegate(this.authModule),
    config.github.app_id
  );

  public getThreads(pair: RenderedChangePair): ThreadPair {
    const leftArgs: ThreadPositionArgs = {
      sha: this.reviewModule.reviewState.base,
      file: this.meta.from,
      line: pair.left.number
    };

    const rightArgs: ThreadPositionArgs = {
      sha: this.reviewModule.reviewState.head,
      file: this.meta.to,
      line: pair.right.number
    };

    return {
      left: this.reviewModule.threadByArgs(leftArgs),
      right: this.reviewModule.threadByArgs(rightArgs)
    };
  }

  public handleEvent(e: Partial<AddCommentEvent>) {
    console.log("ChangeEntry#handleEvent");
    const base = this.reviewModule.reviewState.base;
    e.file = e.sha === base ? this.meta.from : this.meta.to;
    this.bubbleUp(e);
  }

  get tooBig() {
    return this.meta.additions + this.meta.deletions >= 1500;
  }

  get hotKeyMap(): KeyMap {
    return CHANGE_ENTRY_KEY_MAP(this);
  }

  // TODO: When we can expand between chunks this will be a problem
  get totalLength(): number {
    let totalLength = 0;
    this.chunks.forEach(c => (totalLength += c.pairs.length));
    return totalLength;
  }

  get isBinary(): boolean {
    return isBinaryFile(this.meta.from) || isBinaryFile(this.meta.to);
  }

  public activate() {
    this.active = true;
  }

  public deactivate() {
    this.active = false;
    this.setActiveDiffLine(-1);
  }

  public toggle() {
    if (!this.expanded) {
      this.expand();
    } else {
      this.collapse();
    }
  }

  public collapse() {
    this.loading = false;
    this.expanded = false;
  }

  public expand() {
    if (this.loaded) {
      this.expanded = true;
      return;
    }

    // Change is too large to display, so just infinite-load
    if (this.tooBig) {
      this.loading = true;
      this.expanded = true;
      return;
    }

    // TODO: Add some benchmarking here!
    const isLarge = this.totalLength >= 50;

    if (!isLarge) {
      this.expanded = true;
      this.loaded = true;
      return;
    }

    this.loading = true;
    nextRender(() => {
      this.expanded = true;
      this.loaded = true;
      this.loading = false;
    });
  }

  public setActiveDiffLine(index: number) {
    const curr = this.getCurrentLine();
    if (curr) {
      curr.deactivate();
    }

    this.activeLineIndex = index;
    const next = this.getCurrentLine();
    if (next) {
      next.activate();
    }
  }

  public nextLine() {
    this.setActiveDiffLine(
      Math.min(this.activeLineIndex + 1, this.totalLength - 1)
    );
    makeTopVisible(this.getCurrentLine()!.$el, 150);
  }

  public prevLine() {
    this.setActiveDiffLine(Math.max(this.activeLineIndex - 1, 0));
    // TODO: When scrolling up we don't properly account for the header
    makeTopVisible(this.getCurrentLine()!.$el, 150);
  }

  public addLineComment() {
    const line = this.getCurrentLine();
    if (line) {
      line.addComment();
    }
  }

  public getCurrentLine(): DiffLineAPI | undefined {
    const lines = this.$refs.difflines as DiffLineAPI[];
    if (lines) {
      return lines[this.activeLineIndex];
    }
  }

  public getPrevChunk(index: number): parseDiff.Chunk {
    const chunk = this.chunks[index].chunk;
    return index > 0 ? this.chunks[index - 1].chunk : EMPTY_CHUNK;
  }

  public showChunkHeader(index: number) {
    const chunk = this.chunks[index].chunk;
    const prevChunk = this.getPrevChunk(index);

    const prevLeftEnd = prevChunk.oldStart + prevChunk.oldLines - 1;

    // Check if the chunks are directly adjacent
    const adjacentToPrev = chunk.oldStart === prevLeftEnd + 1;

    // Check if the chunk starts the file
    const bothAtStart = chunk.oldStart <= 1 && chunk.newStart <= 1;

    return !(adjacentToPrev || bothAtStart);
  }

  public async loadLinesAbove(index: number) {
    const data = this.chunks[index];
    const chunk = data.chunk;

    const owner = this.reviewModule.review.metadata.owner;
    const repo = this.reviewModule.review.metadata.repo;

    const leftSha = this.reviewModule.reviewState.base;
    const rightSha = this.reviewModule.reviewState.head;

    const prevChunk = this.getPrevChunk(index);
    const prevLeftEnd = prevChunk.oldStart + prevChunk.oldLines - 1;
    const prevRightEnd = prevChunk.newStart + prevChunk.newLines - 1;

    const leftStart = Math.max(chunk.oldStart - 20, prevLeftEnd + 1);
    const leftEnd = Math.max(chunk.oldStart - 1, 1);
    const leftLines = await this.github.getContentLines(
      owner,
      repo,
      this.meta.from,
      leftSha,
      leftStart,
      leftEnd
    );

    const rightStart = Math.max(chunk.newStart - 20, prevRightEnd + 1);
    const rightEnd = Math.max(chunk.newStart - 1, 1);
    const rightLines = await this.github.getContentLines(
      owner,
      repo,
      this.meta.to,
      rightSha,
      rightStart,
      rightEnd
    );

    // TODO: Handle zipping lines of different lengths
    if (leftLines.length != rightLines.length) {
      console.warn("loadLinesAbove: uneven zip");
    }

    const pairs: RenderedChangePair[] = [];
    for (let i = 0; i < leftLines.length; i++) {
      pairs.push({
        left: renderLoadedLineChange(leftStart + i, leftLines[i]),
        right: renderLoadedLineChange(rightStart + i, rightLines[i]),
        commentsEnabled: false
      });
    }

    // Freeze pairs and add them to the start of the chunk
    const frozen = freezeArray(pairs);
    data.pairs.unshift(...frozen);

    // Change the start/endpoints
    chunk.oldStart = leftStart;
    chunk.oldLines += leftEnd - leftStart + 1;
    chunk.newStart = rightStart;
    chunk.newLines += rightEnd - rightStart + 1;

    // Deactivate active line
    this.setActiveDiffLine(-1);
  }

  get langPair() {
    return {
      left: getFileLang(this.meta.from),
      right: getFileLang(this.meta.to)
    };
  }

  get allThreads() {
    const l: Thread[] = this.reviewModule.threadsByFileAndSha(
      this.meta.from,
      this.reviewModule.reviewState.base
    );
    const r: Thread[] = this.reviewModule.threadsByFileAndSha(
      this.meta.to,
      this.reviewModule.reviewState.head
    );

    return [...l, ...r];
  }

  get countUnresolvedThreads() {
    return this.allThreads.filter(t => !t.draft && !t.resolved).length;
  }

  get additionPct() {
    const exact =
      this.meta.additions / (this.meta.additions + this.meta.deletions);
    if (exact === 0) {
      return 0;
    } else if (exact === 1) {
      return 100;
    } else {
      const asPct = Math.round(exact * 100);
      return Math.max(10, Math.min(asPct, 90));
    }
  }

  get icon() {
    if (this.expanded) {
      return "caret-down";
    } else {
      return "caret-right";
    }
  }

  get added() {
    return this.meta.from === "/dev/null";
  }

  get deleted() {
    return this.meta.to === "/dev/null";
  }

  get title() {
    if (this.meta.from === this.meta.to) {
      return this.meta.from;
    } else if (this.added) {
      return `${this.meta.to}`;
    } else if (this.deleted) {
      return `${this.meta.from}`;
    } else {
      return `${this.meta.from} -> ${this.meta.to}`;
    }
  }
}
</script>

<style scoped lang="postcss">
.active {
  @apply border border-blue-500;
}
</style>
