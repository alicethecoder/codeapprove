<template>
  <div v-html="htmlContent" class="md"></div>
</template>

<script lang="ts">
import { Component, Vue, Prop } from "vue-property-decorator";
import marked from "marked";

const Prism = require("prismjs");

marked.setOptions({
  gfm: true,
  breaks: true,
  highlight: (code, lang) => {
    const pLang = Prism.languages[lang];
    if (pLang) {
      return Prism.highlight(code, pLang, lang);
    } else {
      return Prism.highlight(code, Prism.languages.markup, "markup");
    }
  }
});

@Component
export default class MarkdownContent extends Vue {
  @Prop() content!: string;

  public htmlContent = "";

  mounted() {
    this.htmlContent = marked(this.content);
  }
}
</script>

<style scoped lang="postcss">
/** 
 * The >>> selectors are needed in order to style within v-html 
 */
.md >>> ul {
  @apply list-disc;
  margin-top: 12px;
  margin-bottom: 12px;
  padding-left: 36px;
}

.md >>> ol {
  @apply list-decimal;
  margin-top: 12px;
  margin-bottom: 12px;
  padding-left: 36px;
}

.md >>> a {
  @apply text-blue-500;
}

.md >>> a:hover {
  @apply text-blue-600;
  text-decoration: underline;
}

.md >>> p {
  @apply mb-3;
}

.md >>> p:last-of-type {
  @apply mb-0;
}

.md >>> pre {
  @apply mb-3 p-2 bg-dark-4;
}

/** Based on https://www.w3schools.com/tags/tag_hn.asp */

.md >>> h1,
.md >>> h2,
.md >>> h3,
.md >>> h4,
.md >>> h5,
.md >>> h6 {
  @apply font-bold font-body mb-2;
  line-height: 1.2;
}

.md >>> h1 {
  font-size: 2em;
}

.md >>> h2 {
  font-size: 1.5em;
}

.md >>> h3 {
  font-size: 1.17em;
}

.md >>> h4 {
  font-size: 1em;
}

.md >>> h5 {
  font-size: 0.83em;
}

.md >>> h6 {
  font-size: 0.67em;
}
</style>
