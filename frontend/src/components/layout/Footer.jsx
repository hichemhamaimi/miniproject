import React from 'react';

const Footer = () => {
    return (
        <footer className="bg-gray-800 text-gray-300 py-6 mt-10">
            <div className="max-w-7xl mx-auto text-center">
                <p>&copy; {new Date().getFullYear()} ExamQ Platform. All rights reserved.</p>
            </div>
        </footer>
    );
};

export default Footer;
