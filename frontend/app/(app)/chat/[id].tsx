import { useLocalSearchParams, useRouter } from "expo-router";
import {
  Dimensions,
  KeyboardAvoidingView,
  Pressable,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import React from "react";
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { ChatMessage } from "../../../types";
import { Image } from "expo-image";
import { TextInput } from "react-native-gesture-handler";
import useWebSocket from "react-use-websocket";
import { FlashList } from "@shopify/flash-list";
import { useSession } from "../../../hooks/useSession";
import {
  API_URL,
  getChatIdFromItemId,
  getItem,
  parseOrThrowResponse,
  postChatRoomWithFirstMessage,
} from "../../../api";

export default function ChatScreen() {
  const router = useRouter();
  const {
    id: itemId,
    chatIdParam,
    sellOrBuy,
    newChat,
    otherUserName,
    showEncourageMessage,
  } = useLocalSearchParams();

  const { session } = useSession();
  const queryClient = useQueryClient();

  const { data: chatId, isError: isErrorChatId } = useQuery({
    queryFn: async () => getChatIdFromItemId(session!.token, itemId as string),
    queryKey: ["chat_id", itemId],
    enabled: !!itemId && !chatIdParam && !!session && !newChat, // run the query if there is no chat id param and is not a new chat
    initialData: parseInt(chatIdParam as string),
  });

  const { data: item, isError: isErrorData } = useQuery({
    queryFn: () => getItem(itemId as string),
    queryKey: ["item", itemId],
    enabled: !!itemId,
  });

  const getChatMessages = async ({ pageParam = 0 }) => {
    const res = await fetch(
      `${API_URL}/chats/messages/${chatId}?offset=${pageParam}`,
      {
        headers: {
          authorization: `Bearer ${session?.token}`,
        },
      }
    );
    return parseOrThrowResponse<{
      data: ChatMessage[];
      next_offset: number;
    }>(res);
  };

  const {
    data: chatMessages,
    isLoading: isLoadingChatMessages,
    isError: isErrorChatMessages,
    fetchNextPage,
    hasNextPage,
    refetch,
  } = useInfiniteQuery({
    queryFn: getChatMessages,
    queryKey: ["messages", chatId],
    enabled: !!chatId,
    getNextPageParam: (lastPage) => {
      const nextPage =
        lastPage.data.length === 25 ? lastPage.next_offset : undefined;
      return nextPage;
    },
  });

  const width = Dimensions.get("window").width / 7;
  const [inputText, setInputText] = React.useState("");

  const { sendMessage, lastMessage } = useWebSocket(
    "wss://api.gavinwang.dev/ws",
    {
      queryParams: {
        authorization: `Bearer_${session?.token}`,
      },
      shouldReconnect: () => true,
      onOpen: () => {
        if (chatId) {
          sendMessage(`/join ${chatId}`);
        }
      },
      reconnectInterval: 5,
      onMessage: (e) => {
        console.debug(e.data);
        if (
          (e.data as string).endsWith("send success") ||
          (e.data as string).endsWith("receive success")
        ) {
          console.debug("message sent successfully and invalidating");
          queryClient.invalidateQueries(["messages", chatId]);
          queryClient.invalidateQueries(["chats", sellOrBuy]);
        }
      },
    }
  );

  const createChatRoomAndFirstMessageMutation = useMutation({
    mutationFn: (firstMessage: string) =>
      postChatRoomWithFirstMessage(
        session!.token,
        firstMessage,
        itemId as string
      ),
    onSuccess: (data) => {
      sendMessage(`/join ${data}`);
      queryClient.setQueryData(["chat_id", itemId], data);
      queryClient.invalidateQueries(["chats", sellOrBuy]);
      queryClient.invalidateQueries(["messages", data]);
    },
  });

  const chatMessagesData = React.useMemo(() => {
    if (!chatMessages?.pages) {
      return [];
    }
    console.debug("processing messages");
    let lastDisplayString = "";
    const curTime = new Date();
    const messages = chatMessages.pages.flatMap((page) =>
      page.data.map((message) => {
        return message;
      })
    );
    for (let i = messages.length - 1; i >= 0; i--) {
      const message = messages[i];
      if (!message.sent_at) {
        continue;
      }
      const sentAtDate = new Date(message.sent_at);
      const timeDiffFromCur = curTime.getTime() - sentAtDate.getTime();

      const dispayTime: boolean = timeDiffFromCur < 1000 * 60 * 60; // less than an hour
      const displayExactTime: boolean = timeDiffFromCur > 1000 * 60 * 60 * 24; // more than a day

      let sentAtString;

      if (dispayTime) {
        sentAtString = dayjs(message.sent_at).format("h:mm A");
      } else if (displayExactTime) {
        sentAtString = dayjs(message.sent_at).format("MMM D, h:mm A");
      } else {
        message.sent_at = null;
        continue;
      }

      if (sentAtString === lastDisplayString) {
        message.sent_at = null;
        continue;
      }

      message.sent_at = sentAtString;
      lastDisplayString = sentAtString;
    }
    return messages;
  }, [chatMessages]);

  const nanoid = React.useMemo(
    () => customAlphabet("abcdefghijklmnopqrstuvwxyz0123456789", 10),
    []
  );
  return (
    <SafeAreaView className="bg-bgLight">
      <View className="bg-bgLight h-full">
        <View className="flex flex-row items-center justify-between ">
          <Pressable onPress={router.back} className="w-10 p-3">
            <LeftChevron />
          </Pressable>
          {otherUserName && (
            <Text className="font-Poppins_600SemiBold text-base text-blackPrimary ">
              {otherUserName}
            </Text>
          )}
          <View className="w-10 p-3" />
        </View>

        <View className="border-y border-y-stone-200">
          <Pressable
            onPress={() =>
              router.push({
                pathname: `/item/${item!.id}`,
                params: {
                  itemString: JSON.stringify(item),
                },
              })
            }
            className="p-3.5 flex-row justify-between items-center bg-stone-50"
            style={{
              height: (width * 4) / 3 + 28,
              opacity: item?.status === "inactive" ? 0.75 : 1,
            }}
          >
            {item && (
              <Image
                transition={{
                  effect: "cross-dissolve",
                  duration: 250,
                }}
                source={{ uri: item.images[0] }}
                className="object-cover rounded-sm"
                style={{
                  minWidth: width,
                  minHeight: (width * 4) / 3,
                  width: width,
                  height: (width * 4) / 3,
                  backgroundColor: Colors.grayLight,
                }}
              />
            )}
            <View className="mx-4 flex flex-grow flex-col">
              {item && (
                <>
                  <Text className="font-Poppins_600SemiBold text-base text-blackPrimary">
                    {item.name}
                  </Text>
                  <Text className="font-Manrope_400Regular text-sm max-w-[250px] max-h-[40px] text-blackPrimary">
                  {!(item.description && item.description.trim())
                    ? "No description provided."
                    : item.description.trim()}
                  </Text>
                  <Text className="font-Manrope_600SemiBold text-sm text-purplePrimary">
                    {item.status === "inactive"
                      ? "Item is no longer available."
                      : ""}
                  </Text>
                </>
              )}
            </View>
            <Text className="font-Poppins_600SemiBold text-base text-blackPrimary">
              ${item && item.price}
            </Text>
          </Pressable>
        </View>
        <KeyboardAvoidingView
          behavior="padding"
          style={{ flex: 1 }}
          keyboardVerticalOffset={64}
        >
          {chatMessagesData.length === 0 && showEncourageMessage === "true" ? (
            <View className="flex-grow flex flex-col justify-center items-center w-full">
              <Text className="font-Manrope_500Medium text-gray-500">
                start by sending some messages to seller.
              </Text>
            </View>
          ) : (
            <FlashList
              data={chatMessagesData}
              renderItem={Message}
              keyExtractor={(_, index) => index.toString()}
              maintainVisibleContentPosition={{
                minIndexForVisible: 0,
              }}
              inverted
              estimatedItemSize={50}
              onEndReached={() => {
                if (!hasNextPage) {
                  console.debug("no next page");
                  return;
                }
                console.debug("refetching messages");
                fetchNextPage();
              }}
              showsVerticalScrollIndicator={true}
              contentContainerStyle={{
                padding: 10,
              }}
            />
          )}

          <View>
            <TextInput
              placeholder="Message"
              className="px-4 py-2 mx-2 border rounded-full border-gray-400"
              value={inputText}
              onChangeText={setInputText}
              blurOnSubmit={false}
              onSubmitEditing={async () => {
                if (!inputText.trim()) return;
                if (!chatId) {
                  console.debug("no chat id so create one");
                  createChatRoomAndFirstMessageMutation.mutate(inputText);
                  setInputText("");
                } else {
                  const correlationId = nanoid();
                  console.debug(
                    "sending message with correlation id",
                    correlationId
                  );
                  sendMessage(
                    `/message ${chatId} ${correlationId} ${inputText}`
                  );
                  setInputText("");
                }
              }}
            />
          </View>
        </KeyboardAvoidingView>
      </View>
    </SafeAreaView>
  );
}

import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import LeftChevron from "../../../components/LeftChevron";
import { customAlphabet } from "nanoid/non-secure";
import Colors from "../../../constants/Colors";
dayjs.extend(relativeTime);
const Message = ({ item: message }: { item: ChatMessage }) => {
  return (
    <View className="flex flex-col items-center">
      {message.sent_at !== null ? (
        <Text className="mt-3 mb-1 mr-2 text-sm font-Manrope_500Medium text-grayPrimary">
          {message.sent_at}
        </Text>
      ) : null}

      <View
        className={`flex flex-row items-center ${
          message.from_me ? "ml-auto" : "mr-auto"
        }`}
      >
        <View
          className={`flex flex-row rounded-xl p-2 w-fit my-1.5 ${
            message.from_me
              ? " bg-purplePrimary"
              : " bg-grayLight border border-stone-300"
          }`}
        >
          <Text
            className={`font-Manrope_500Medium text-[15.5px] ${
              message.from_me ? "text-white" : "text-black"
            }`}
          >
            {message.content}
          </Text>
        </View>
      </View>
    </View>
  );
};
