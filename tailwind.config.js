/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./index.html", "./main.js", "./calendar-data.js"],
  theme: {
    extend: {
      colors: {
        // Kita pindahkan variabel warna CSS kamu ke sini agar dikenali Tailwind
        primary: 'var(--accent-color)', 
      }
    },
  },
  plugins: [],
}