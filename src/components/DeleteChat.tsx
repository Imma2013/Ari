'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';

interface DeleteChatProps {
  chatId: string;
  redirect?: boolean;
  chats: any[];
  setChats: (chats: any[]) => void;
}

const DeleteChat: React.FC<DeleteChatProps> = ({
  chatId,
  redirect = false,
  chats,
  setChats,
}) => {
  const [isDeleting, setIsDeleting] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const router = useRouter();

  const handleDelete = async () => {
    if (!chatId) return;
    
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/chats/${chatId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!res.ok) {
        throw new Error('Failed to delete conversation');
      }

      // Update chats list if provided
      if (chats.length > 0) {
        const newChats = chats.filter(chat => chat.id !== chatId);
        setChats(newChats);
      }

      toast.success('Conversation deleted successfully', {
        duration: 3000,
        style: {
          background: '#10b981',
          color: 'white',
          border: 'none',
        },
      });

      if (redirect) {
        router.push('/library');
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete conversation', {
        duration: 4000,
        style: {
          background: '#ef4444',
          color: 'white',
          border: 'none',
        },
      });
    } finally {
      setIsDeleting(false);
      setIsOpen(false);
    }
  };

  return (
    <AlertDialog open={isOpen} onOpenChange={setIsOpen}>
      <AlertDialogTrigger asChild>
        <button className="p-2 text-white/70 hover:text-white transition-colors hover:bg-red-500/20 rounded-lg">
          <Trash2 size={17} />
        </button>
      </AlertDialogTrigger>
      <AlertDialogContent className="max-w-md bg-light-secondary dark:bg-dark-secondary border border-light-200 dark:border-dark-200">
        <AlertDialogHeader>
          <div className="flex items-center space-x-3 mb-2">
            <div className="p-2 bg-red-100 dark:bg-red-950/30 rounded-lg">
              <Trash2 className="w-5 h-5 text-red-600 dark:text-red-400" />
            </div>
            <AlertDialogTitle className="text-lg font-semibold text-black dark:text-white">
              Delete Conversation
            </AlertDialogTitle>
          </div>
          <AlertDialogDescription className="text-black/70 dark:text-white/70 leading-relaxed">
            Are you sure you want to delete this conversation? This action cannot be undone and all messages will be permanently removed.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <AlertDialogFooter className="flex-col-reverse sm:flex-row gap-2">
          <AlertDialogCancel 
            className="bg-transparent hover:bg-light-100 dark:hover:bg-dark-100 text-black dark:text-white border-light-200 dark:border-dark-200"
            disabled={isDeleting}
          >
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={isDeleting}
            className="bg-red-500 hover:bg-red-600 text-white border-0 disabled:opacity-50"
          >
            {isDeleting ? (
              <>
                <motion.div
                  className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full mr-2"
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                />
                Deleting...
              </>
            ) : (
              <>
                <Trash2 className="w-4 h-4 mr-2" />
                Delete conversation
              </>
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default DeleteChat;
