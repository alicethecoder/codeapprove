<template>
  <div class="relative w-full">
    <div v-if="active" class="shim bg-yellow-100"></div>

    <!-- Left -->
    <div
      class="ib relative w-1/2 align-top"
      @mouseenter="hovered.left = true"
      @mouseleave="hovered.left = false"
    >
      <div class="shim" :class="bgClass(rendered.left)"></div>
      <code class="line-number">{{ lineNumberString(rendered.left) }}</code>
      <code class="line-marker">{{ rendered.left.marker }}</code>
      <prism inline :language="langs.left" class="line-content">{{
        rendered.left.content
      }}</prism>

      <button
        v-show="showCommentButton('left')"
        @click="drafting.left = true"
        class="comment-button"
      >
        <font-awesome-icon icon="comment" />
      </button>

      <CommentThread
        v-if="showComments('left')"
        class="w-full"
        :line="rendered.left.number"
        :sha="getThreadSha('left')"
        :threadId="getThreadId('left')"
        @cancel="onCommentCancel('left')"
      />
    </div>

    <!-- Right -->
    <div
      class="ib relative w-1/2 align-top"
      @mouseenter="hovered.right = true"
      @mouseleave="hovered.right = false"
    >
      <div class="shim" :class="bgClass(rendered.right)"></div>
      <code class="line-number">{{ lineNumberString(rendered.right) }}</code>
      <code class="line-marker">{{ rendered.right.marker }}</code>
      <prism inline :language="langs.right" class="line-content">{{
        rendered.right.content
      }}</prism>

      <button
        v-show="showCommentButton('right')"
        @click="drafting.right = true"
        class="comment-button"
      >
        <font-awesome-icon icon="comment" />
      </button>

      <CommentThread
        v-if="showComments('right')"
        class="w-full"
        :line="rendered.right.number"
        :sha="getThreadSha('right')"
        :threadId="getThreadId('right')"
        @cancel="onCommentCancel('right')"
      />
    </div>
  </div>
</template>

<script lang="ts">
import { Component, Prop, Vue, Watch, Mixins } from "vue-property-decorator";
import { getModule } from "vuex-module-decorators";
import parseDiff from "parse-diff";

import CommentThread from "@/components/elements/CommentThread.vue";
import { EventEnhancer } from "../mixins/EventEnhancer";
import ReviewModule from "../../store/modules/review";
import { ThreadPair, LangPair, Side, SidePair } from "../../model/review";
import { Comment, ThreadPositionArgs, Thread } from "../../../../shared/types";
import {
  RenderedChangePair,
  renderChange,
  RenderedChange
} from "../../plugins/diff";
import * as events from "../../plugins/events";
import { DiffLineAPI } from "../api";

@Component({
  components: {
    CommentThread
  }
})
export default class DiffLine extends Mixins(EventEnhancer)
  implements DiffLineAPI {
  @Prop() public langs!: LangPair;
  @Prop() public threads!: ThreadPair;
  @Prop() public rendered!: RenderedChangePair;

  reviewModule = getModule(ReviewModule, this.$store);

  public comments: SidePair<Comment[]> = {
    left: [],
    right: []
  };

  public hovered: SidePair<boolean> = {
    left: false,
    right: false
  };

  public drafting: SidePair<boolean> = {
    left: false,
    right: false
  };

  public active = false;

  mounted() {
    events.on(events.NEW_THREAD_EVENT, this.onNewThread);
    this.loadComments();
  }

  destroyed() {
    events.off(events.NEW_THREAD_EVENT, this.onNewThread);
  }

  private onNewThread(event: events.NewThreadEvent) {
    const matchesLeft = this.getThreadId("left") === event.threadId;
    const matchesRight = this.getThreadId("right") === event.threadId;

    if (matchesLeft || matchesRight) {
      console.log(`onNewThread: matches ${event.threadId}`);
      this.loadThreads();
      this.loadComments();
    }
  }

  public handleEvent(e: Partial<events.AddCommentEvent>) {
    console.log("DiffLine#handleEvent");
    const base = this.reviewModule.viewState.base;
    const side: Side = e.sha === base ? "left" : "right";
    e.lineContent = this.rendered[side].content;
    this.bubbleUp(e);
  }

  public activate() {
    this.active = true;
  }

  public deactivate() {
    this.active = false;

    if (document.activeElement) {
      (document.activeElement as HTMLElement).blur();
    }
  }

  public addComment() {
    if (!this.rendered.commentsEnabled) {
      return;
    }

    const hasRight = !this.rendered.right.empty;
    if (hasRight) {
      this.drafting.right = true;
    } else {
      this.drafting.left = true;
    }
  }

  public onCommentCancel(side: Side) {
    this.hovered[side] = false;
    this.drafting[side] = false;
  }

  public loadThreads() {
    const leftId = this.getThreadId("left");
    if (leftId !== null) {
      this.threads.left = this.reviewModule.threadById(leftId);
      this.drafting.left = false;
    }

    const rightId = this.getThreadId("right");
    if (rightId !== null) {
      this.threads.right = this.reviewModule.threadById(rightId);
      this.drafting.right = false;
    }
  }

  public loadComments() {
    this.comments = {
      left: this.getComments("left"),
      right: this.getComments("right")
    };
  }

  public showComments(side: Side) {
    return this.drafting[side] || this.comments[side].length > 0;
  }

  public showCommentButton(side: Side) {
    if (!this.rendered.commentsEnabled) {
      return false;
    }

    return (
      !this.rendered[side].empty &&
      this.hovered[side] &&
      !this.showComments(side)
    );
  }

  public getComments(side: Side) {
    const threadId = this.getThreadId(side);
    if (threadId != null) {
      return this.reviewModule.commentsByThread(threadId);
    }
    return [];
  }

  public getThreadSha(side: Side): string {
    if (side === "left") {
      return this.reviewModule.viewState.base;
    } else {
      return this.reviewModule.viewState.head;
    }
  }

  public getThreadId(side: Side): string | null {
    const thread = this.threads[side];
    return thread === null ? null : thread.id;
  }

  public bgClass(change: RenderedChange): string {
    if (!this.rendered.commentsEnabled) {
      return "bg-gray-700";
    }

    switch (change.type) {
      case "del":
        return "bg-red-700";
      case "add":
        return "bg-green-700";
      default:
        return "hidden";
    }
  }

  public lineNumberString(change: RenderedChange): string {
    if (change.empty) {
      return "";
    }

    return change.number.toString();
  }
}
</script>

<style scoped lang="postcss">
code {
  background: transparent !important;
}

.line-content code[class*="language-"] {
  @apply text-wht-brt;
}

.shim {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 2;

  opacity: 0.15;
}

.ib {
  @apply inline-block;
}

.no-select {
  user-select: none;
}

.line-content {
  @apply whitespace-pre-wrap;
}

.line-number {
  @apply px-2 no-select overflow-hidden;
  min-width: 3rem;
}

.line-marker {
  @apply inline-block px-1 text-center no-select;
  min-width: 1rem;
}

.comment-button {
  @apply z-10 absolute top-0 right-0;
  @apply px-2 ml-2 rounded shadow bg-purple-500 text-white;
}

.comment-button:hover {
  @apply bg-purple-600;
}
</style>
