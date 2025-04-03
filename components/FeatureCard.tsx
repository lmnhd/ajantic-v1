import React from 'react';
import Image, { StaticImageData } from 'next/image';

interface FeatureCardProps {
  title: string;
  description: string;
  link: string;
  icon: React.ReactNode;
  className?: string;
  target?: '_blank' | '_self';
  ariaLabel?: string;
  image?: StaticImageData;
}

const FeatureCard: React.FC<FeatureCardProps> = ({ 
  title, 
  description, 
  link, 
  icon,
  className = '',
  target = '_self',
  ariaLabel,
  image,
}) => (
  <div 
    className={`feature-card group border rounded-lg overflow-hidden bg-white dark:bg-gray-800 
    shadow-md hover:shadow-xl transition-all duration-300 ${className}`}
    role="article"
  >
    {image && (
      <div className="relative w-full h-48 overflow-hidden">
        <Image
          src={image}
          alt={title}
          fill
          className="object-cover transform group-hover:scale-105 transition-transform duration-300"
        />
      </div>
    )}
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="text-3xl text-indigo-600 dark:text-indigo-400 
          group-hover:scale-110 transition-transform duration-300">
          {icon}
        </div>
        <h3 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">{title}</h3>
      </div>
      <p className="text-gray-600 dark:text-gray-300 mb-4">{description}</p>
      <a 
        href={link} 
        className="inline-flex items-center text-indigo-600 dark:text-indigo-400 
          hover:text-indigo-800 dark:hover:text-indigo-300 font-medium 
          transition-colors duration-200"
        target={target}
        rel={target === '_blank' ? 'noopener noreferrer' : undefined}
        aria-label={ariaLabel || `Learn more about ${title}`}
      >
        Learn More
        <svg 
          className="w-4 h-4 ml-2 transform group-hover:translate-x-1 transition-transform duration-200" 
          fill="none" 
          viewBox="0 0 24 24" 
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </a>
    </div>
  </div>
);

export default FeatureCard;