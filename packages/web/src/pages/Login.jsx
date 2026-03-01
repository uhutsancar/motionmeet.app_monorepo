import { SignIn } from "@clerk/clerk-react";
import React from "react";
import { Link } from "react-router-dom";

const Login = () => {
  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-white font-sans">

      {/* Left side: Login Form */}
      <div className="flex-1 flex flex-col pt-8 md:pt-12 px-6 lg:px-20 relative">
        {/* Header/Logo */}
        <div className="absolute top-6 left-6 md:top-8 md:left-12 flex items-center gap-2 font-bold text-xl tracking-wide">
          <div className="w-8 h-8 bg-blue-600 text-white rounded-md flex items-center justify-center shadow-sm">
            <span className="leading-none text-2xl -mt-0.5">M</span>
          </div>
          MotionMeet
        </div>

        {/* Form Container */}
        <div className="flex-1 flex flex-col items-center justify-center mt-12 md:mt-0">
          <div className="w-full max-w-md">
            {/* We use Clerk's SignIn component. We can pass appearance props to customize it slightly to match the wireframe, but default provides social & email. */}
            <SignIn
              appearance={{
                elements: {
                  rootBox: "w-full mx-auto",
                  card: "bg-white shadow-none w-full border-0 p-0",
                  headerTitle: "text-3xl font-bold text-gray-900 mb-2 text-center",
                  headerSubtitle: "hidden",
                  socialButtonsBlockButton: "w-full border-gray-200 text-gray-700 font-semibold bg-gray-50 hover:bg-gray-100 mb-2 h-12 rounded-lg",
                  dividerRow: "my-6",
                  formFieldLabel: "text-gray-700 font-medium mb-1",
                  formFieldInput: "w-full h-12 rounded-lg border-gray-300 focus:border-blue-500 focus:ring-blue-500",
                  formButtonPrimary: "w-full h-12 rounded-lg bg-gray-400 hover:bg-gray-500 text-white font-bold text-lg mt-2 transition-colors duration-200",
                  footerAction: "mt-6 text-center text-gray-600",
                  footerActionLink: "text-blue-500 hover:text-blue-600 font-semibold",
                }
              }}
              routing="path"
              path="/login"
              signUpUrl="/signup"
              fallbackRedirectUrl="/feed"
            />
          </div>
        </div>
      </div>

      {/* Right side: Branding / Mockup */}
      <div className="hidden md:flex flex-1 bg-gray-50 relative overflow-hidden items-center justify-center p-12">
        {/* Decorative background lines */}
        <div className="absolute inset-0 z-0 opacity-20" style={{ backgroundImage: 'radial-gradient(circle at center, #3b82f6 1px, transparent 1px)', backgroundSize: '40px 40px' }}></div>
        <div className="absolute top-0 right-0 w-[500px] h-[500px] border-[1px] border-blue-500 rounded-full blur-[100px] opacity-20 -mr-40 -mt-40 pointer-events-none"></div>

        {/* Mockup Display */}
        <div className="relative z-10 w-full max-w-xl">
          <div className="bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden flex flex-col">
            <div className="h-6 bg-gray-100 border-b border-gray-200 flex items-center px-4 gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-red-400"></div>
              <div className="w-2.5 h-2.5 rounded-full bg-yellow-400"></div>
              <div className="w-2.5 h-2.5 rounded-full bg-green-400"></div>
            </div>
            <div className="p-8 aspect-[4/3] flex flex-col">
              <div className="flex justify-between items-center mb-6">
                <div className="font-bold text-gray-900 flex items-center gap-2">
                  <div className="w-5 h-5 bg-blue-600 rounded text-xs text-white flex justify-center items-center">M</div> Dashboard
                </div>
                <div className="flex gap-4 text-sm font-medium text-gray-400">
                  <span className="text-blue-600">Feed</span>
                  <span>Routines</span>
                  <span>Exercises</span>
                </div>
              </div>

              {/* Fake Feed Content */}
              <div className="flex-1 bg-gray-50 rounded-lg border border-gray-100 p-4 space-y-4">
                <div className="flex gap-3">
                  <div className="w-10 h-10 bg-gray-200 rounded-full"></div>
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="w-24 h-4 bg-gray-200 rounded"></div>
                      <div className="w-16 h-3 bg-gray-100 rounded"></div>
                    </div>
                    <div className="w-48 h-5 bg-gray-800 rounded"></div>
                    <div className="flex gap-4 pt-1">
                      <div className="w-12 h-8 bg-gray-200 rounded text-xs flex items-center justify-center text-gray-500">1h 15m</div>
                      <div className="w-16 h-8 bg-gray-200 rounded text-xs flex items-center justify-center text-gray-500">9 250kg</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Overlapping Mobile Mockup */}
          <div className="absolute -left-12 -bottom-12 w-64 h-[450px] bg-white rounded-[32px] shadow-2xl border-8 border-gray-900 overflow-hidden transform rotate-2">
            <div className="absolute top-0 w-full h-5 bg-gray-900 flex justify-center z-20">
              <div className="w-24 h-5 bg-gray-900 rounded-b-xl"></div>
            </div>
            <div className="bg-gray-50 w-full h-full p-4 pt-8">
              <div className="flex justify-between items-center mb-4">
                <div className="w-6 h-6 rounded bg-gray-200"></div>
                <div className="bg-blue-600 text-white text-[10px] font-bold px-3 py-1.5 rounded-full">Finish</div>
              </div>
              <div className="space-y-2">
                <div className="w-3/4 h-4 bg-gray-800 rounded"></div>
                <div className="flex gap-2 mb-4">
                  <div className="w-12 h-3 bg-gray-300 rounded"></div>
                  <div className="w-12 h-3 bg-gray-300 rounded"></div>
                </div>
                <div className="bg-green-100 p-2 rounded flex justify-between">
                  <div className="text-[10px] text-green-700 font-bold">W 30kg x 6</div>
                  <div className="w-3 h-3 rounded-full bg-green-500"></div>
                </div>
                <div className="bg-green-100 p-2 rounded flex justify-between">
                  <div className="text-[10px] text-green-700 font-bold">1 52.5kg x 5</div>
                  <div className="w-3 h-3 rounded-full bg-green-500"></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
};

export default Login;
