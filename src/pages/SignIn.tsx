import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

// 1) i18n import
import { useTranslation } from 'react-i18next';

// 2) Auth
import { useAuth } from '../contexts/AuthContext';
import { LogIn } from 'lucide-react';

// 3) Language selector
import LanguageSelector from '../components/LanguageSelector';

// Validation schema
const schema = z.object({
  email: z.string().email('Invalid email address'), // can localize if desired
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

type FormData = z.infer<typeof schema>;

export default function SignIn() {
  const { signIn } = useAuth();
  const { t } = useTranslation();  // i18n usage
  const {
    register,
    handleSubmit,
    formState: { errors },
    setError: setFormError,
  } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (data: FormData) => {
    console.log('Form submitted with data:', data);
    try {
      await signIn(data.email, data.password);
      // Possibly navigate to a dashboard if signIn was successful
      // e.g.: navigate('/admin/dashboard');
    } catch (error: any) {
      console.error('Sign-in error:', error.message);
      // Use a translated key for the error prefix
      setFormError('root', { 
        type: 'manual', 
        message: `${t('auth.signInError')}: ${error.message}` 
      });
    }
  };

  return (
    <div className="relative min-h-screen bg-gray-100 flex items-center justify-center">
      
      {/* 4) Language selector at top-right corner */}
      <div className="absolute top-4 right-4">
        <LanguageSelector />
      </div>

      <div className="bg-white p-8 rounded-lg shadow-md w-full max-w-md">
        <div className="flex items-center justify-center mb-8">
          <LogIn className="w-12 h-12 text-blue-600" />
        </div>

        {/* Use translated signIn title */}
        <h1 className="text-2xl font-bold text-center mb-6">
          {t('auth.signIn')}
        </h1>
        
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">
              {t('auth.email')}
            </label>
            <input
              type="email"
              {...register('email')}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm 
                         focus:border-blue-500 focus:ring-blue-500"
            />
            {errors.email && (
              <p className="mt-1 text-sm text-red-600">{errors.email.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              {t('auth.password')}
            </label>
            <input
              type="password"
              {...register('password')}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm 
                         focus:border-blue-500 focus:ring-blue-500"
            />
            {errors.password && (
              <p className="mt-1 text-sm text-red-600">{errors.password.message}</p>
            )}
          </div>

          {errors.root && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-md">
              <p className="text-sm text-red-600">{errors.root.message}</p>
            </div>
          )}

          <button
            type="submit"
            className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md
                       shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700
                       focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            {t('auth.signIn')} {/* again using translation */}
          </button>
        </form>

        <p className="mt-4 text-center text-sm text-gray-600">
          {t('auth.noAccount')}{' '}
          <a
            href="/registrieren"
            className="font-medium text-blue-600 hover:text-blue-500"
          >
            {t('auth.register')}
          </a>
        </p>
      </div>
    </div>
  );
}