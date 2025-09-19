<template>
  <div class="engine-container bg-gradient-to-br from-gray-900 via-gray-800 to-black">
    <div class="engine-wrapper" :style="wrapperStyle">
      <slot>
        <Game />
      </slot>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import projectData from '@generate/project';
import { Game } from '@generate/components/app';

const wrapperStyle = computed(() => ({
  // Use the project's configured base size to set aspect ratio
  '--aspect-ratio': `${projectData.config.canvas_size.width} / ${projectData.config.canvas_size.height}`,
  '--aspect-w': String(projectData.config.canvas_size.width),
  '--aspect-h': String(projectData.config.canvas_size.height),
  'background-color': '#1a1a1a', // Dark background for the engine area
  position: 'relative' as const,
  overflow: 'hidden' as const,
  'aspect-ratio': 'var(--aspect-ratio)',
}));
</script>

<style scoped>
.engine-container {
  width: 100vw;
  height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  box-sizing: border-box;
}

.engine-wrapper {
  position: relative;
  width: 100%;
  /* Constrain to viewport while preserving configured aspect ratio */
  max-width: calc(100vh * (var(--aspect-w) / var(--aspect-h)));
  max-height: calc(100vw * (var(--aspect-h) / var(--aspect-w)));
  aspect-ratio: var(--aspect-ratio);
  overflow: hidden;
  box-shadow: 0 0 20px rgba(0, 0, 0, 0.5);
  border-radius: 8px;
}
</style>
