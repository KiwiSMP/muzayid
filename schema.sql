@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  --font-outfit: 'Outfit', sans-serif;
  --font-cairo: 'Cairo', sans-serif;
}

html[dir="ltr"] {
  font-family: var(--font-outfit), sans-serif;
}

html[dir="rtl"] {
  font-family: var(--font-cairo), sans-serif;
}

@layer base {
  * {
    box-sizing: border-box;
  }
  
  body {
    @apply bg-[#F8FAFC] text-slate-900;
    font-family: var(--font-outfit), var(--font-cairo), sans-serif;
  }
  
  /* RTL improvements */
  [dir="rtl"] {
    font-family: var(--font-cairo), sans-serif;
    text-align: right;
  }
  
  [dir="rtl"] .font-outfit {
    font-family: var(--font-outfit), sans-serif;
  }
}

@layer utilities {
  .font-outfit {
    font-family: var(--font-outfit), sans-serif;
  }
  
  .font-cairo {
    font-family: var(--font-cairo), sans-serif;
  }
}

/* Scrollbar */
::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}
::-webkit-scrollbar-track {
  background: transparent;
}
::-webkit-scrollbar-thumb {
  background: #cbd5e1;
  border-radius: 100px;
}
::-webkit-scrollbar-thumb:hover {
  background: #94a3b8;
}

/* Focus rings */
input:focus-visible,
textarea:focus-visible,
select:focus-visible,
button:focus-visible {
  outline: 2px solid #1E3A5F;
  outline-offset: 2px;
}

/* Smooth transitions */
*, *::before, *::after {
  transition-property: color, background-color, border-color, box-shadow;
  transition-duration: 150ms;
  transition-timing-function: ease;
}

/* Reset transitions for animations */
[class*="animate-"],
[class*="transition-"] {
  transition-property: all;
}
