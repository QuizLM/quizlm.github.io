
import React from 'react';

const App: React.FC = () => {
  return (
    <main className="flex items-center justify-center h-screen w-screen bg-gray-100 dark:bg-gray-900">
      <div className="text-center">
        <h1 className="text-5xl font-extrabold text-gray-800 dark:text-white sm:text-7xl">
          Hello, World!
        </h1>
        <p className="mt-4 text-lg text-gray-600 dark:text-gray-300">
          This is a simple React application styled with Tailwind CSS.
        </p>
      </div>
    </main>
  );
};

export default App;
