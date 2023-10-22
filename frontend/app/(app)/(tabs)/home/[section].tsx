import { router, useLocalSearchParams } from "expo-router";
import {
  FlatList,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { TabView } from "react-native-tab-view";
import { useQuery } from "@tanstack/react-query";
import { RefreshControl } from "react-native-gesture-handler";
import { useState } from "react";
import { ApiResponse } from "../../../../types/api";
import { ItemListing } from "../../../../components/ItemListing";
import { LogoWithText } from "../../../../components/Logo";
import { ItemWithImage } from "../../../../types/types";

export const SECTIONS = [
  { display: "All", value: "all" },
  { display: "Women's", value: "womens" },
  { display: "Men's", value: "mens" },
  { display: "Home & Tools", value: "home" },
  { display: "Furniture", value: "furniture" },
  { display: "Electronics", value: "electronics" },
  { display: "Bikes & Scooters", value: "bikes" },
  { display: "Tickets", value: "tickets" },
  { display: "General", value: "general" },
  { display: "Free", value: "free" },
];

export default function HomePage() {
  const param = useLocalSearchParams();
  const selectedSection = param.section;

  const fetchUrlPath =
    selectedSection == "all" ? "/items/" : `/items/category/${selectedSection}`;
  const {
    data: items,
    isLoading: isLoadingItems,
    isError: isErrorItems,
    refetch: refetchItems,
  } = useQuery({
    queryFn: async () =>
      fetch(process.env.EXPO_PUBLIC_BACKEND_URL + fetchUrlPath).then((x) =>
        x.json()
      ) as Promise<ApiResponse<ItemWithImage[]>>,
    queryKey: ["item", selectedSection],
  });

  const [refreshing, _] = useState(false);

  return (
    <View className="bg-bgLight h-full">
      <View className="flex flex-row items-center px-2.5 pb-2.5 h-[40px]">
        <LogoWithText className="flex-grow" />
        <View className="flex justify-center bg-grayLight items-center rounded-md flex-grow ml-2.5">
          <TextInput placeholder="Search here" className="p-2 w-full" />
        </View>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        className="border-y border-grayLight flex flex-row  min-h-[45px] max-h-[42px] "
      >
        {SECTIONS.map((section) => {
          return (
            <Pressable
              key={section.value}
              onPress={() => {
                if (section.value === selectedSection) {
                  return;
                }
                void router.replace(`/home/${section.value}`);
              }}
              className="px-3 h-full justify-center"
            >
              <Text
                className={`font-Poppins_500Medium ${
                  section.value === selectedSection
                    ? "text-purplePrimary"
                    : "text-gray-400"
                }`}
              >
                {section.display}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
      <View className="bg-grayMedium h-full ">
        {isLoadingItems ? (
          <Text>...</Text>
        ) : isErrorItems ? (
          <Text>Something went wrong</Text>
        ) : items.data.length === 0 ? (
          <Text>No items</Text>
        ) : (
          <FlatList
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={() => {
                  refetchItems();
                }}
              />
            }
            data={items.data}
            numColumns={2}
            columnWrapperStyle={{
              justifyContent: "flex-start",
              marginTop: 12,
              paddingHorizontal: 10,
            }}
            contentContainerStyle={{
              paddingBottom: 92,
            }}
            keyExtractor={(item) => item.id.toString()}
            renderItem={ItemListing}
          />
        )}
      </View>
    </View>
  );
}
