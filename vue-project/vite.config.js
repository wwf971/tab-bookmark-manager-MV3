import { fileURLToPath, URL } from 'node:url'
import { resolve } from 'node:path'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'
import { copyFileSync, existsSync } from 'fs'

// Custom plugin to copy user config files
const copyUserConfigPlugin = () => {
  return {
    name: 'copy-user-config',
    writeBundle() {
      // Copy user config files to dist directory
      const configFiles = ['user.config.js', 'user.config.0.js']
      
      configFiles.forEach(filename => {
        const srcPath = resolve(__dirname, filename)
        const destPath = resolve(__dirname, 'dist', filename)
        
        if (existsSync(srcPath)) {
          try {
            copyFileSync(srcPath, destPath)
            console.log(`Copied ${filename} to dist directory`)
          } catch (error) {
            console.warn(`Failed to copy ${filename}:`, error.message)
          }
        } else {
          console.warn(`Config file ${filename} not found, skipping copy`)
        }
      })
    }
  }
}

// https://vite.dev/config/
export default defineConfig(({ command }) => ({
  root: 'src',
  base: './',
  plugins: [
    vue(),
    vueDevTools(),
    copyUserConfigPlugin(),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    },
  },
  define: {
    'process.env.VUE_APP_IS_DEV': JSON.stringify(command === 'serve')
  },
  server: {
    open: '/main.html', // Open main.html by default
    port: 5173
  },
  publicDir: false, // Disable copying of public directory
  build: {
    outDir: '../dist', // Output to the project's dist directory
    emptyOutDir: true,
    rollupOptions: {
      input: {
        popup: fileURLToPath(new URL('./src/popup.html', import.meta.url)),
        main: fileURLToPath(new URL('./src/main.html', import.meta.url))
      },
      output: {
        entryFileNames: 'assets/[name].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name].[ext]'
      }
    },
    // Ensure dependencies are bundled
    modulePreload: false,
    cssCodeSplit: true,
    minify: false, // For easier debugging
    sourcemap: true
  }
}))
