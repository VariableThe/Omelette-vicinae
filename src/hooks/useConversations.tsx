import { LocalStorage, showToast, Toast } from "@raycast/api";
import { useState, useCallback, useMemo } from "react";
import { Conversation } from "../types/conversation";
import { useQuestions } from "./useQuestions";
import { useMountEffect } from "./useMountEffect";

export function useConversations() {
  const [rawData, setRawData] = useState<Conversation[]>([]);
  const [isRawLoaded, setIsRawLoaded] = useState(false);
  const {
    isLoading: isLoadingQuestions,
    getByConversationId: getQuestionsByConversationId,
    removeByConversationId: removeQuestionByConversationId,
    refresh: refreshQuestions,
  } = useQuestions();

  useMountEffect(() => {
    (async () => {
      try {
        const stored = await LocalStorage.getItem<string>("conversations");
        if (stored) {
          const items: Conversation[] = JSON.parse(stored);
          setRawData(items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
        }
      } catch (error) {
        console.error("Failed to load conversations from localStorage:", error);
      } finally {
        setIsRawLoaded(true);
      }
    })();
  });

  // Derived state (Rule 1): enrich conversations with questions inline
  const isLoading = !isRawLoaded || isLoadingQuestions;
  const data = useMemo(
    () =>
      isLoading
        ? []
        : rawData.map((conversation) => ({
            ...conversation,
            questions: getQuestionsByConversationId(conversation.id),
          })),
    [isLoading, rawData, getQuestionsByConversationId],
  );

  const saveToLocalStorage = async (conversations: Conversation[]) => {
    try {
      await LocalStorage.setItem("conversations", JSON.stringify(conversations));
    } catch (error) {
      showToast({
        title: "Failed to save conversation",
        style: Toast.Style.Failure,
      });
      throw error;
    }
  };

  const add = useCallback(
    async (conversation: Conversation) => {
      const toast = await showToast({
        title: "Creating conversation...",
        style: Toast.Style.Animated,
      });
      const newData = [...rawData, conversation];
      await saveToLocalStorage(newData);
      setRawData(newData);

      toast.title = "Conversation created!";
      toast.style = Toast.Style.Success;
    },
    [rawData],
  );

  const update = useCallback(
    async (conversation: Conversation) => {
      const toast = await showToast({
        title: "Updating Conversation...",
        style: Toast.Style.Animated,
      });

      const newData = rawData.map((c) => (c.id === conversation.id ? conversation : c));
      await saveToLocalStorage(newData);
      setRawData(newData);

      toast.title = "Conversation updated!";
      toast.style = Toast.Style.Success;
    },
    [rawData],
  );

  const remove = useCallback(
    async (conversation: Conversation) => {
      const toast = await showToast({
        title: "Removing conversation...",
        style: Toast.Style.Animated,
      });

      try {
        // Remove all questions in conversation
        await removeQuestionByConversationId(conversation.id);

        // Remove conversation
        const newData = rawData.filter((q) => q.id !== conversation.id);
        await saveToLocalStorage(newData);
        setRawData(newData);

        toast.title = "Conversation removed!";
        toast.style = Toast.Style.Success;
      } catch (error) {
        console.error("Error removing conversation:", error);
        toast.title = "Failed to remove conversation";
        toast.style = Toast.Style.Failure;
      }
    },
    [rawData],
  );

  const refresh = useCallback(async () => {
    try {
      const stored = await LocalStorage.getItem<string>("conversations");

      if (stored) {
        const items: Conversation[] = JSON.parse(stored);
        const sortedItems = items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

        // Refresh questions hook in order to fetch latest enrichedItems
        await refreshQuestions();

        setRawData(sortedItems);
      } else {
        console.error("Error refreshing conversations: No conversations found.");
      }
    } catch (error) {
      console.error("Error refreshing conversations:", error);
    }
  }, [refreshQuestions]);

  return useMemo(
    () => ({ data, isLoading, add, update, remove, refresh }),
    [data, isLoading, add, update, remove, refresh],
  );
}
