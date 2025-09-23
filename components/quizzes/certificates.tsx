"use client";
import React, { useState, useEffect } from 'react';
import { getQuizResponse } from '@/utils/quizzes/indexedDB';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/utils/cn';
import quizDataImport from '@/components/quizzes/quizData.json';
import Quiz from '@/components/quizzes/quiz';
import { Accordion, Accordions } from 'fumadocs-ui/components/accordion';
import { Linkedin, Twitter, Award, Share2 } from 'lucide-react';
import { AwardBadgeWrapper } from './components/awardBadgeWrapper';
import { useRouter } from 'next/navigation';
import { toast } from '@/hooks/use-toast';

interface CertificatePageProps {
  courseId: string;
}

interface QuizInfo {
  id: string;
  chapter: string;
  question: string;
}

interface QuizData {
  question: string;
  options: string[];
  correctAnswers: number[];
  hint: string;
  explanation: string;
  chapter: string;
}

interface Course {
  title: string;
  quizzes: string[];
}

interface QuizDataStructure {
  courses: {
    [courseId: string]: Course;
  };
  quizzes: {
    [quizId: string]: QuizData;
  };
}

const quizData = quizDataImport as QuizDataStructure;

const CertificatePage: React.FC<CertificatePageProps> = ({ courseId }) => {
  const router = useRouter();
  const [completedQuizzes, setCompletedQuizzes] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  // Name will be derived from the authenticated BuilderHub account on the server
  const [isGenerating, setIsGenerating] = useState(false);
  const [quizzes, setQuizzes] = useState<QuizInfo[]>([]);
  const [totalQuizzes, setTotalQuizzes] = useState(0);
  const [correctlyAnsweredQuizzes, setCorrectlyAnsweredQuizzes] = useState(0);
  const [shouldShowCertificate, setShouldShowCertificate] = useState(false);
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);
  const [certificatePdfUrl, setCertificatePdfUrl] = useState<string | null>(null);

  useEffect(() => {
    const fetchQuizzes = () => {
      const courseQuizzes = quizData.courses[courseId]?.quizzes || [];
      const quizzesWithChapters = courseQuizzes.map(quizId => ({
        id: quizId,
        chapter: quizData.quizzes[quizId]?.chapter || 'Unknown Chapter',
        question: quizData.quizzes[quizId]?.question || ''
      }));
      setQuizzes(quizzesWithChapters);
      setTotalQuizzes(courseQuizzes.length);

      // If no quizzes found, set loading to false to prevent infinite loading
      if (courseQuizzes.length === 0) {
        setIsLoading(false);
      }
    };

    fetchQuizzes();
  }, [courseId]);

  useEffect(() => {
    const checkQuizCompletion = async () => {
      const completed = await Promise.all(
        quizzes.map(async (quiz) => {
          const response = await getQuizResponse(quiz.id);
          return response && response.isCorrect ? quiz.id : null;
        })
      );

      const completedIds = completed.filter((id): id is string => id !== null);
      setCompletedQuizzes(completedIds);
      setCorrectlyAnsweredQuizzes(completedIds.length);
      setIsLoading(false);
    };

    if (quizzes.length > 0) {
      checkQuizCompletion();
    }
  }, [quizzes]);


  useEffect(() => {
    if (totalQuizzes > 0 && correctlyAnsweredQuizzes === totalQuizzes) {

      setShouldShowCertificate(true);

      setTimeout(() => {

      }, 3000);
    }
  }, [correctlyAnsweredQuizzes, totalQuizzes]);

  const handleQuizCompleted = (quizId: string) => {
    if (!completedQuizzes.includes(quizId)) {
      setCompletedQuizzes(prev => [...prev, quizId]);
      setCorrectlyAnsweredQuizzes(prev => prev + 1);
    }
  };

  const allQuizzesCompleted = shouldShowCertificate;

  const generateCertificate = async () => {
    setIsGenerating(true);
    let response: Response | undefined;

    try {
      response = await fetch('/api/generate-certificate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          courseId,
        }),
      });

      if (!response.ok) {
        // Handle authentication error specifically
        if (response.status === 401) {
          toast({
            title: "Authentication Required",
            description: "Please sign in to your BuilderHub account to generate certificates.",
            variant: "destructive",
          });
          setIsGenerating(false);
          // Redirect to login after a short delay
          setTimeout(() => {
            router.push('/login');
          }, 2000);
          return;
        }
        
        // Try to get error details from response
        try {
          const errorData = await response.json();
          console.error('Server error details:', errorData);
          
          // Check for specific error types
          if (errorData.error?.includes('Email address required')) {
            toast({
              title: "Email Required",
              description: "Please ensure your BuilderHub account has a valid email address.",
              variant: "destructive",
            });
            setIsGenerating(false);
            return;
          }
          
          throw new Error(errorData.error || errorData.details || 'Failed to generate certificate');
        } catch (jsonError) {
          throw new Error(`Failed to generate certificate (${response.status})`);
        }
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      
      // Store the PDF URL for sharing
      setCertificatePdfUrl(url);
      
      // Download the PDF
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = `${courseId}_certificate.pdf`;
      document.body.appendChild(a);
      a.click();
      // Don't revoke the URL immediately as we need it for sharing
      
      // Show success message and redirect
      setShowSuccessMessage(true);
      setTimeout(() => {
        // Redirect to the appropriate academy page
        if (courseId.startsWith('codebase-entrepreneur-')) {
          router.push('/codebase-entrepreneur-academy');
        } else {
          router.push('/academy');
        }
      }, 3000);
    } catch (error: any) {
      console.error('Error generating certificate:', error);
      
      // Generic error handling for unexpected errors
      toast({
        title: "Certificate Generation Failed",
        description: error.message || "An unexpected error occurred. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const chapters = [...new Set(quizzes.map(quiz => quiz.chapter))];

  const quizzesByChapter = chapters.reduce((acc, chapter) => {
    acc[chapter] = quizzes.filter(quiz => quiz.chapter === chapter);
    return acc;
  }, {} as Record<string, QuizInfo[]>);

  const shareOnLinkedIn = () => {
    const organizationName = 'Avalanche';
    const organizationId = 19104188;
    const certificationName = encodeURIComponent(quizData.courses[courseId].title);
    const issuedMonth = new Date().getMonth() + 1;
    const issuedYear = new Date().getFullYear();

    return `https://www.linkedin.com/profile/add?startTask=CERTIFICATION_NAME&name=${certificationName}&organizationId=${organizationId}&issueMonth=${issuedMonth}&issueYear=${issuedYear}&organizationName=${organizationName}`;
  };

  const shareOnTwitter = () => {
    const text = `I just completed the ${quizData.courses[courseId].title} course on Avalanche Academy! 🎉`;
    const url = `https://x.com/intent/tweet?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
  };
  
  const viewCertificate = () => {
    if (certificatePdfUrl) {
      window.open(certificatePdfUrl, '_blank');
    }
  };

  if (isLoading) {
    return <div>Loading...</div>;
  }

  if (!quizData.courses[courseId]) {
    return (
      <div className="max-w-4xl mx-auto p-4">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6">
          <h2 className="text-xl font-semibold text-red-800 dark:text-red-200 mb-2">Course Not Found</h2>
          <p className="text-red-600 dark:text-red-300">
            The course "{courseId}" could not be found. Please check the course ID and try again.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-4">
      {!shouldShowCertificate && chapters.map((chapter) => {
        const chapterQuizzes = quizzesByChapter[chapter];

        return (
          <div key={chapter} className="mb-8">
            <h3 className="text-xl font-medium mb-4">{chapter}</h3>
            <Accordions type="single" collapsible>
              {chapterQuizzes.map((quiz) => (
                <Accordion key={quiz.id} title={`${quiz.question}`}>
                  <Quiz quizId={quiz.id} onQuizCompleted={handleQuizCompleted} />
                </Accordion>
              ))}
            </Accordions>
          </div>
        );
      })}

      {showSuccessMessage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-8 max-w-md w-full mx-4 transform transition-all">
            <div className="flex items-center justify-center mb-4">
              <Award className="w-12 h-12 text-green-500" />
            </div>
            <h3 className="text-2xl font-bold text-center text-gray-800 dark:text-white mb-4">
              Certificate Downloaded!
            </h3>
            <p className="text-center text-gray-600 dark:text-gray-300">
              Your certificate has been successfully generated and downloaded. 
              You'll be redirected to the academy page in a moment...
            </p>
            <div className="mt-6 flex justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-500"></div>
            </div>
          </div>
        </div>
      )}

      {allQuizzesCompleted && !showSuccessMessage && (

        <div className="mt-12 bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8">
          <AwardBadgeWrapper courseId={courseId} isCompleted={allQuizzesCompleted} />
          <div className="flex items-center justify-center mb-6">
            <Award className="w-16 h-16 text-green-500 mr-4" />
            <h2 className="text-3xl font-bold text-gray-800 dark:text-white" style={{ fontSize: '2rem', marginTop: '1em' }}>Congratulations!</h2>
          </div>
          <p className="text-center text-gray-600 dark:text-gray-300 mb-8">
            You've completed all quizzes for the {quizData.courses[courseId].title} course. Claim your certificate now!
          </p>
          <button
            className={cn(
              buttonVariants({ variant: 'default' }),
              'w-full mb-6 py-3 text-lg relative overflow-hidden'
            )}
            onClick={generateCertificate}
            disabled={isGenerating}
          >
            {isGenerating ? (
              <span className="flex items-center justify-center">
                <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></span>
                Generating Certificate...
              </span>
            ) : (
              'Generate My Certificate'
            )}
          </button>
          <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
            <p className="text-center text-gray-600 dark:text-gray-300 mb-2">
              Share your achievement:
            </p>
            <p className="text-center text-sm text-gray-500 dark:text-gray-400 mb-4">
              Your certificate PDF has been downloaded. You can attach it when sharing on social media.
            </p>
            <div className="flex justify-center space-x-4">
              {certificatePdfUrl && (
                <button
                  onClick={viewCertificate}
                  className={cn(
                    buttonVariants({ variant: 'secondary' }),
                    'flex items-center px-4 py-2'
                  )}
                >
                  <Award className="mr-2 h-5 w-5" />
                  View Certificate
                </button>
              )}
              <a href={shareOnLinkedIn()} target="_blank" rel="noopener noreferrer"
                style={{ textDecoration: 'none' }}
                className={cn(
                  buttonVariants({ variant: 'secondary' }),
                  'flex items-center px-4 py-2'
                )}
              >
                <Linkedin className="mr-2 h-5 w-5" />
                Add to LinkedIn
              </a>
              <button
                className={cn(
                  buttonVariants({ variant: 'secondary' }),
                  'flex items-center px-4 py-2'
                )}
                onClick={shareOnTwitter}
              >
                <Twitter className="mr-2 h-5 w-5" />
                Share on X
              </button>
            </div>
          </div>
        </div>
      )}
      {!allQuizzesCompleted && (
        <div className="mt-12 bg-muted rounded-lg shadow-lg p-8">
          <Share2 className="w-8 h-8 mx-auto mb-2 text-yellow-500" />
          Complete all quizzes to unlock your certificate and share your achievement!
        </div>
      )}
    </div>
  );
};

export default CertificatePage;