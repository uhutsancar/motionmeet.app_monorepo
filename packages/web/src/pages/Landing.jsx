import React from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, Globe } from 'lucide-react';
import { assets } from '~/assets/assets';
import { useTranslation } from 'react-i18next';

const Landing = () => {
    const { t, i18n } = useTranslation();

    const toggleLanguage = () => {
        const newLang = i18n.language.startsWith('en') ? 'tr' : 'en';
        i18n.changeLanguage(newLang);
        localStorage.setItem('appLanguage', newLang);
    };

    return (
        <div className="min-h-screen bg-white text-gray-900 font-sans">
            {/* Header */}
            <header className="fixed top-0 w-full bg-white z-50 px-6 py-4 flex justify-between items-center max-w-7xl mx-auto left-0 right-0">
                <div className="flex items-center gap-2">
                    {/* Logo Placeholder */}
                    <div className="flex items-center gap-2 font-bold text-xl tracking-tight">
                        <div className="w-8 h-8 bg-blue-600 text-white rounded-md flex items-center justify-center">
                            <span className="leading-none text-2xl -mt-0.5">M</span>
                        </div>
                        MotionMeet
                    </div>
                </div>

                <nav className="hidden md:flex items-center gap-8 font-medium text-gray-600">
                    <a href="#features" className="hover:text-blue-600 transition">{t('landing.features')}</a>
                    <a href="#about" className="hover:text-blue-600 transition">{t('landing.about')}</a>
                </nav>

                <div className="flex items-center gap-4">
                    {/* Language Toggle in Header */}
                    <button
                        onClick={toggleLanguage}
                        className="flex items-center gap-1.5 text-gray-600 hover:text-gray-900 transition mr-2"
                    >
                        <Globe className="w-5 h-5" />
                        <span className="text-sm font-bold">{i18n.language.toUpperCase().substring(0, 2)}</span>
                    </button>

                    <Link to="/login" className="font-semibold text-blue-600 hover:text-blue-700 transition">{t('landing.login')}</Link>
                    <Link to="/login" className="bg-blue-500 hover:bg-blue-600 text-white px-5 py-2.5 rounded-lg font-semibold transition">{t('landing.signup')}</Link>
                </div>
            </header>

            {/* Hero Section */}
            <section className="pt-32 pb-20 px-6 max-w-7xl mx-auto flex flex-col md:flex-row items-center gap-12">
                <div className="flex-1 space-y-8">
                    <h1 className="text-5xl md:text-7xl font-extrabold leading-tight text-gray-900 tracking-tight">
                        {t('landing.log_workouts')}<br />
                        <span className="text-blue-500">{t('landing.get_stronger')}</span><br />
                        {t('landing.stay_motivated')}
                    </h1>
                    <p className="text-xl text-gray-600 max-w-lg">
                        {t('landing.description')}
                    </p>

                    <div className="flex items-center gap-4 pt-4">
                        {/* App Store Buttons placeholders */}
                        <div className="bg-black text-white px-4 py-2 rounded-xl flex items-center gap-2 cursor-pointer hover:bg-gray-800 transition">
                            <div className="w-6 h-6 bg-white rounded-full"></div>
                            <div className="flex flex-col">
                                <span className="text-[10px] leading-none text-gray-300">Download on the</span>
                                <span className="text-sm font-semibold leading-tight">App Store</span>
                            </div>
                        </div>
                        <div className="bg-black text-white px-4 py-2 rounded-xl flex items-center gap-2 cursor-pointer hover:bg-gray-800 transition">
                            <div className="w-6 h-6 bg-white rounded-full"></div>
                            <div className="flex flex-col">
                                <span className="text-[10px] leading-none text-gray-300">GET IT ON</span>
                                <span className="text-sm font-semibold leading-tight">Google Play</span>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-4 pt-6">
                        {/* Ratings */}
                        <div className="flex -space-x-2">
                            <div className="w-8 h-8 rounded-full bg-gray-300 border-2 border-white"></div>
                            <div className="w-8 h-8 rounded-full bg-gray-400 border-2 border-white"></div>
                            <div className="w-8 h-8 rounded-full bg-gray-500 border-2 border-white"></div>
                        </div>
                        <div>
                            <p className="text-sm font-medium">The #1 workout tracker. Loved by athletes.</p>
                            <div className="flex items-center gap-1 text-yellow-400 text-sm mt-0.5">
                                ★★★★★ <span className="text-gray-500 ml-1">4.9 App Store & Google Play</span>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="flex-1 flex justify-center relative">
                    {/* Mobile mockup placeholder */}
                    <div className="w-[300px] h-[600px] bg-white border-8 border-gray-900 rounded-[40px] shadow-2xl overflow-hidden relative z-10">
                        <div className="absolute top-0 w-full h-6 bg-gray-900 flex justify-center">
                            <div className="w-32 h-6 bg-gray-900 rounded-b-2xl"></div>
                        </div>
                        <div className="p-4 pt-10">
                            <div className="font-bold text-center mb-6">Log Workout</div>
                            {/* Dummy Workout items */}
                            <div className="space-y-4">
                                <div className="bg-blue-50 p-3 rounded-lg border border-blue-100">
                                    <span className="font-semibold text-blue-600 block mb-2">Bench Press (Barbell)</span>
                                    <div className="flex justify-between text-sm text-gray-500 mb-1">
                                        <span>Set 1</span>
                                        <span>62kg × 7</span>
                                    </div>
                                    <div className="flex justify-between text-sm text-gray-500">
                                        <span>Set 2</span>
                                        <span>65kg × 8</span>
                                    </div>
                                </div>
                                <div className="bg-gray-50 p-3 rounded-lg border border-gray-100">
                                    <span className="font-semibold text-gray-800 block mb-2">Overhead Press</span>
                                    <div className="flex justify-between text-sm text-gray-500">
                                        <span>Set 1</span>
                                        <span>40kg × 8</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Featured On */}
            <section className="py-12 border-y border-gray-100">
                <div className="max-w-7xl mx-auto px-6 text-center">
                    <h3 className="text-xl font-bold text-gray-800 mb-8">Featured on</h3>
                    <div className="flex flex-wrap justify-center items-center gap-12 md:gap-24 opacity-60 font-bold text-2xl">
                        <span className="text-red-600">MEN'S JOURNAL</span>
                        <span className="text-gray-800">FINANCIAL TIMES</span>
                        <span className="text-red-700 bg-white">Mirror</span>
                        <span className="text-gray-600 font-serif">THE ECONOMIC TIMES</span>
                    </div>
                </div>
            </section>

            {/* Feature 1 */}
            <section className="py-24 max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center gap-16">
                <div className="flex-1 bg-gray-50 rounded-3xl p-12 flex justify-center aspect-square">
                    <div className="w-64 h-[500px] bg-white border-8 border-gray-900 rounded-[32px] shadow-xl overflow-hidden relative">
                        <div className="p-4 pt-8">
                            {/* Dummy routine display */}
                            <div className="w-full h-8 bg-blue-500 rounded-md mb-4 text-white font-bold flex items-center justify-center text-sm">Finish Workout</div>
                            <div className="bg-green-100 p-2 rounded mb-2 border border-green-200">
                                <span className="text-green-700 text-xs font-bold">W 40kg x 7</span>
                            </div>
                            <div className="bg-green-100 p-2 rounded border border-green-200">
                                <span className="text-green-700 text-xs font-bold">1 62kg x 7</span>
                            </div>
                        </div>
                    </div>
                </div>
                <div className="flex-1 space-y-6">
                    <h2 className="text-4xl md:text-5xl font-bold text-gray-900">Log workouts</h2>
                    <p className="text-xl text-gray-600">
                        A workout tracking app that <em>just works</em>. Everything you need to log your workouts and smash your goals.
                    </p>
                    <ul className="space-y-4 pt-4">
                        {[
                            'Intuitive Workout Logging',
                            'Advanced Routine Planner',
                            'Mark Warmup, Drop, and Failure Sets',
                            'Automatic Rest Timers',
                            'Add Exercise Notes'
                        ].map((text, i) => (
                            <li key={i} className="flex items-center gap-3 text-lg font-medium text-gray-800">
                                <CheckCircle2 className="text-gray-900 w-6 h-6 fill-current" />
                                {text}
                            </li>
                        ))}
                    </ul>
                </div>
            </section>

            {/* Feature 2: Progress */}
            <section className="py-24 bg-gray-50">
                <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row-reverse items-center gap-16">
                    <div className="flex-1 bg-white rounded-3xl p-12 flex justify-center shadow-sm aspect-square relative overflow-hidden">
                        <div className="w-72 h-[550px] bg-white border border-gray-200 rounded-2xl shadow-xl mt-8 absolute p-4">
                            <div className="flex items-center gap-4 border-b pb-4 mb-4">
                                <div className="w-16 h-16 bg-gray-100 rounded flex items-center justify-center">
                                    <span className="text-4xl text-gray-400">🏋️</span>
                                </div>
                                <div className="font-bold text-lg">Bench Press</div>
                            </div>
                            {/* Fake Chart */}
                            <div className="w-full h-40 flex items-end justify-between px-2 pt-10">
                                <div className="w-2 h-10 bg-blue-200 rounded-t"></div>
                                <div className="w-2 h-16 bg-blue-300 rounded-t"></div>
                                <div className="w-2 h-12 bg-blue-300 rounded-t"></div>
                                <div className="w-2 h-24 bg-blue-400 rounded-t relative">
                                    <div className="absolute -top-6 -left-3 bg-yellow-400 text-white text-[10px] font-bold px-1 rounded">PR</div>
                                </div>
                                <div className="w-2 h-20 bg-blue-400 rounded-t"></div>
                                <div className="w-2 h-[120px] bg-blue-500 rounded-t"></div>
                            </div>
                        </div>
                    </div>
                    <div className="flex-1 space-y-6">
                        <h2 className="text-4xl md:text-5xl font-bold text-gray-900">Measure progress</h2>
                        <p className="text-xl text-gray-600">
                            Staying motivated is easier when you can see how far you've come.
                        </p>
                        <ul className="space-y-4 pt-4">
                            {[
                                'Advanced Exercise Charts',
                                'Personal Records',
                                'Calculate One Rep Max',
                                'High Quality Exercise Videos',
                                'Create Your Own Custom Exercises',
                                'Complete Exercise History'
                            ].map((text, i) => (
                                <li key={i} className="flex items-center gap-3 text-lg font-medium text-gray-800">
                                    <CheckCircle2 className="text-gray-900 w-6 h-6 fill-current" />
                                    {text}
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>
            </section>

            {/* Footer */}
            <footer className="bg-white pt-20 pb-12 border-t border-gray-200">
                <div className="max-w-7xl mx-auto px-6">
                    <div className="grid grid-cols-2 md:grid-cols-6 gap-8 mb-16">
                        {/* Logo & Socials */}
                        <div className="col-span-2 space-y-6">
                            <div className="flex items-center gap-2 font-bold text-2xl tracking-tight">
                                <div className="w-8 h-8 bg-black text-white rounded-md flex items-center justify-center">
                                    <span className="leading-none text-2xl -mt-0.5">M</span>
                                </div>
                                MotionMeet
                            </div>
                            <div className="flex gap-4 text-gray-400">
                                <div className="w-8 h-8 rounded-full border border-gray-200 flex items-center justify-center hover:bg-gray-50 hover:text-gray-900 cursor-pointer transition">
                                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path fillRule="evenodd" d="M12.315 2c2.43 0 2.784.013 3.808.06 1.064.049 1.791.218 2.427.465a4.902 4.902 0 011.772 1.153 4.902 4.902 0 011.153 1.772c.247.636.416 1.363.465 2.427.048 1.067.06 1.407.06 4.123v.08c0 2.643-.012 2.987-.06 4.043-.049 1.064-.218 1.791-.465 2.427a4.902 4.902 0 01-1.153 1.772 4.902 4.902 0 01-1.772 1.153c-.636.247-1.363.416-2.427.465-1.067.048-1.407.06-4.123.06h-.08c-2.643 0-2.987-.012-4.043-.06-1.064-.049-1.791-.218-2.427-.465a4.902 4.902 0 01-1.772-1.153 4.902 4.902 0 01-1.153-1.772c-.247-.636-.416-1.363-.465-2.427-.047-1.024-.06-1.379-.06-3.808v-.63c0-2.43.013-2.784.06-3.808.049-1.064.218-1.791.465-2.427a4.902 4.902 0 011.153-1.772A4.902 4.902 0 015.45 2.525c.636-.247 1.363-.416 2.427-.465C8.901 2.013 9.256 2 11.685 2h.63zm-.081 1.802h-.468c-2.456 0-2.784.011-3.807.058-.975.045-1.504.207-1.857.344-.467.182-.8.398-1.15.748-.35.35-.566.683-.748 1.15-.137.353-.3.882-.344 1.857-.047 1.023-.058 1.351-.058 3.807v.468c0 2.456.011 2.784.058 3.807.045.975.207 1.504.344 1.857.182.466.399.8.748 1.15.35.35.683.566 1.15.748.353.137.882.3 1.857.344 1.054.048 1.37.058 4.041.058h.08c2.597 0 2.917-.01 3.96-.058.976-.045 1.505-.207 1.858-.344.466-.182.8-.398 1.15-.748.35-.35.566-.683.748-1.15.137-.353.3-.882.344-1.857.048-1.055.058-1.37.058-4.041v-.08c0-2.597-.01-2.917-.058-3.96-.045-.976-.207-1.505-.344-1.858a3.097 3.097 0 00-.748-1.15 3.098 3.098 0 00-1.15-.748c-.353-.137-.882-.3-1.857-.344-1.023-.047-1.351-.058-3.807-.058zM12 6.865a5.135 5.135 0 110 10.27 5.135 5.135 0 010-10.27zm0 1.802a3.333 3.333 0 100 6.666 3.333 3.333 0 000-6.666zm5.338-3.205a1.2 1.2 0 110 2.4 1.2 1.2 0 010-2.4z" clipRule="evenodd" /></svg>
                                </div>
                                <div className="w-8 h-8 rounded-full border border-gray-200 flex items-center justify-center hover:bg-gray-50 hover:text-gray-900 cursor-pointer transition">
                                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path d="M8.29 20.251c7.547 0 11.675-6.253 11.675-11.675 0-.178 0-.355-.012-.53A8.348 8.348 0 0022 5.92a8.19 8.19 0 01-2.357.646 4.118 4.118 0 001.804-2.27 8.224 8.224 0 01-2.605.996 4.107 4.107 0 00-6.993 3.743 11.65 11.65 0 01-8.457-4.287 4.106 4.106 0 001.27 5.477A4.072 4.072 0 012.8 9.713v.052a4.105 4.105 0 003.292 4.022 4.095 4.095 0 01-1.853.07 4.108 4.108 0 003.834 2.85A8.233 8.233 0 012 18.407a11.616 11.616 0 006.29 1.84" /></svg>
                                </div>
                                <div className="w-8 h-8 rounded-full border border-gray-200 flex items-center justify-center hover:bg-gray-50 hover:text-gray-900 cursor-pointer transition">
                                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path fillRule="evenodd" d="M22 12c0-5.523-4.477-10-10-10S2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.878v-6.987h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.988C18.343 21.128 22 16.991 22 12z" clipRule="evenodd" /></svg>
                                </div>
                            </div>
                        </div>

                        {/* Product */}
                        <div className="flex flex-col gap-4">
                            <span className="font-bold text-gray-900 mb-2">Product</span>
                            <a href="#" className="text-sm font-medium text-gray-600 hover:text-gray-900 transition">Features</a>
                            <a href="#" className="text-sm font-medium text-gray-600 hover:text-gray-900 transition">Reviews</a>
                            <a href="#" className="text-sm font-medium text-gray-600 hover:text-gray-900 transition">Affiliate Program</a>
                            <a href="#" className="text-sm font-medium text-gray-600 hover:text-gray-900 transition">Use Cases</a>
                            <a href="#" className="text-sm font-medium text-gray-600 hover:text-gray-900 transition">Help Center</a>
                            <a href="#" className="text-sm font-medium text-gray-600 hover:text-gray-900 transition">MotionMeet Coach</a>
                        </div>

                        {/* Company */}
                        <div className="flex flex-col gap-4">
                            <span className="font-bold text-gray-900 mb-2">Company</span>
                            <a href="#" className="text-sm font-medium text-gray-600 hover:text-gray-900 transition">About</a>
                            <a href="#" className="text-sm font-medium text-gray-600 hover:text-gray-900 transition">Contact Us</a>
                            <a href="#" className="text-sm font-medium text-gray-600 hover:text-gray-900 transition">Careers</a>
                            <a href="#" className="text-sm font-medium text-gray-600 hover:text-gray-900 transition">Press Center</a>
                        </div>

                        {/* Resources */}
                        <div className="flex flex-col gap-4">
                            <span className="font-bold text-gray-900 mb-2">Resources</span>
                            <a href="#" className="text-sm font-medium text-gray-600 hover:text-gray-900 transition">Blog</a>
                            <a href="#" className="text-sm font-medium text-gray-600 hover:text-gray-900 transition">Guides</a>
                            <a href="#" className="text-sm font-medium text-gray-600 hover:text-gray-900 transition">Exercise Library</a>
                            <a href="#" className="text-sm font-medium text-gray-600 hover:text-gray-900 transition">Workout Splits</a>
                            <a href="#" className="text-sm font-medium text-gray-600 hover:text-gray-900 transition">Public API</a>
                        </div>

                        {/* Guides */}
                        <div className="flex flex-col gap-4">
                            <span className="font-bold text-gray-900 mb-2">Guides</span>
                            <a href="#" className="text-sm font-medium text-gray-600 hover:text-gray-900 transition">3 Day Workout Splits</a>
                            <a href="#" className="text-sm font-medium text-gray-600 hover:text-gray-900 transition">4 Day Workout Splits</a>
                            <a href="#" className="text-sm font-medium text-gray-600 hover:text-gray-900 transition">5 Day Workout Splits</a>
                            <a href="#" className="text-sm font-medium text-gray-600 hover:text-gray-900 transition">Upper / Lower Split</a>
                            <a href="#" className="text-sm font-medium text-gray-600 hover:text-gray-900 transition">Push / Pull / Legs (PPL)</a>
                            <a href="#" className="text-sm font-medium text-gray-600 hover:text-gray-900 transition">Arnold Split Workout</a>
                        </div>
                    </div>

                    <div className="pt-8 border-t border-gray-100 flex flex-col md:flex-row items-center justify-between gap-4">
                        <div className="flex flex-wrap text-sm gap-4 text-gray-500 font-medium pb-2 md:pb-0">
                            <a href="#" className="hover:text-gray-900 transition">Terms & Conditions</a>
                            <a href="#" className="hover:text-gray-900 transition">Privacy Policy</a>
                            <a href="#" className="hover:text-gray-900 transition">Status</a>
                            <a href="#" className="hover:text-gray-900 transition">Sitemap</a>
                        </div>
                        <p className="text-xs text-gray-400 max-w-lg text-center md:text-left">
                            Copyright © 2026 MotionMeet Studios. All rights reserved. MotionMeet® is a registered trademark of MotionMeet Studios in the United States as well as certain other jurisdictions.
                        </p>
                    </div>
                </div>
            </footer>
        </div>
    );
};

export default Landing;
