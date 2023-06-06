# -*- coding: utf-8 -*-
import os
import numpy as np
np.set_printoptions(precision=3)
import pandas as pd
import json
import random
import ast
import pickle
import math
# import seaborn as sns
# sns.set()

from tqdm import tqdm
from sklearn.preprocessing import MinMaxScaler, StandardScaler
from sklearn.neighbors import NearestNeighbors
from statistics import mean
from sklearn.manifold import MDS, TSNE
from sklearn.cluster import DBSCAN
from itertools import combinations
from copy import copy, deepcopy
# from matplotlib import pyplot as plt
from scipy.spatial import distance_matrix
from scipy.spatial import procrustes
from scipy.special import comb
from operator import add
from datetime import datetime

depth = lambda L: isinstance(L, list) and max(map(depth, L)) + 1

class Preprocess:
    def __init__(self, dataset='Forestfires', sample_type='all', sample_rate=None, output_subs=None):
        self.dataset = dataset
        self.output_subs = output_subs
        self.sample_type = sample_type
        self.sample_rate = sample_rate
        self.knn_k_ratio = 0.025
        self.sub_k = 6
        self.max_cluster_level = 2
        # Seeds have not run yet
        self.min_pts_ratio = {
            'Forestfires': 0.08,
            'Pendigits-test': 1 / 30
        }
        self.min_min_pts = 3
        self.min_cluster_size = 6
        self.raw_data = None
        self.dims = None
        self.data = None
        self.subs = None
        self.subs_items_knn = None
        self.subs_dist_df = None
        self.subs_k_neighbors = None
        self.subs_k_dist = None
        self.subs_color = None
        self.subs_proj = None
        self.cluster_input = 'proj'  # original or proj
        self.subs_hier_clusters = None
        self.parent_dir = os.path.join(os.path.abspath(os.path.dirname(os.getcwd())), 'data', dataset)

    def process(self):
        start_time = datetime.now()
        print('processing start')
        print('------------------------------------------------\n')
        print('minPtsRatio:', self.min_pts_ratio[self.dataset])
        self.raw_data = self.parse_csv()
        self.dims = list(self.raw_data.columns)
        self.dim_num = len(self.dims)
        # self.data = self.standardize()
        self.data = self.raw_data
        self.data_num = self.data.shape[0]
        self.subs = self.get_subs()
        # self.subs = self.sample_subs()
        print('subs sampled')
        print('------------------------------------------------')
        # print(self.subs)
        self.sub_num = len(self.subs)
        self.knn_k = self.get_knn_k()
        self.subs_items_knn = self.get_subs_items_knn()
        print('subs knn calculated')
        print('------------------------------------------------')
        self.pairwise_subs_items_dist_df = self.get_pairwise_subs_items_dist_df()
        print('pairwise subs df calculated')
        print('------------------------------------------------')
        self.subs_dist_df = self.get_subs_dist_df()

        # self.draw_subs_proj('original')
        # self.draw_subs_dist_mat('original')
        # print('subs dist df calculated')
        # print('------------------------------------------------')

        self.subs_color = self.get_subs_color()

        if self.cluster_input == 'proj':
            self.subs_dist_df = None
            self.subs_dist_df = self.get_proj_subs_dist_df()
        #     # self.draw_subs_proj('projected')
        #     self.draw_subs_dist_mat('projected')

        self.subs_k_neighbors = self.get_subs_k_neighbors()
        print('subs k items calculated')
        print('------------------------------------------------')
        self.subs_items_k_dist = self.get_subs_items_k_dist()
        self.subs_proj = self._get_subs_proj()
        # self.subs_proj = self._get_subs_tsne()
        print('subs proj calculated')
        print('------------------------------------------------')
        self.subs_hier_clusters = self.get_subs_hier_clusters()
        # print('subs_hier_clusters: \n', self.subs_hier_clusters)
        print('subs hierarchical clusters calculated')
        print('------------------------------------------------')

        first_level_cluster_num = 0
        first_level_cluster_len = []
        for i, cluster in enumerate(self.subs_hier_clusters):
            if isinstance(cluster, list):
                first_level_cluster_num += 1
                first_level_cluster_len.append(len(cluster))
                print('cluster', i, 'len:', len(cluster))
                second_level_cluster_num = 0
                second_level_cluster_len = []
                for sub_cluster in cluster:
                    if isinstance(sub_cluster, list):
                        second_level_cluster_num += 1
                        second_level_cluster_len.append(len(sub_cluster))
                print("cluster %d's second cluster num:" %i, second_level_cluster_num)
                print("cluster %d's second cluster len:" %i, second_level_cluster_len)
        print('------------------------------------------------')
        # print('subs_hier_clusters: \n', self.subs_hier_clusters)
        
        self.subs_cluster_index_df = self.get_subs_cluster_index_df()
        self.subtree = self.init_tree()
        print('subtree initialized')
        print('------------------------------------------------')
        self.subtree_node = self.init_subtree_node(False, self.subs, self.subs_dist_df, self.subs_items_k_dist)
        self.build_subtree_node(self.subtree, self.subtree_node)
        print('subtree node constructed')
        print('------------------------------------------------')
        self.subs_data_proj = self.get_subs_data_proj(True)
        print('subs data proj calculated')
        print('------------------------------------------------')
        self.save_res()
        end_time = datetime.now()
        print('processing finished, cost', (end_time - start_time).seconds, 'seconds')
        print('------------------------------------------------')

    def parse_csv(self):
        data_dir = os.path.join(self.parent_dir, 'data.csv')
        return pd.read_csv(data_dir)

    def scale(self):
        raw_values = self.raw_data.to_numpy()
        scaler = MinMaxScaler()
        values = scaler.fit_transform(raw_values)
        return pd.DataFrame(values, columns=self.dims)

    def standardize(self):
        raw_values = self.raw_data.to_numpy()
        scaler = StandardScaler()
        values = scaler.fit_transform(raw_values)
        return pd.DataFrame(values, columns=self.dims)

    def get_knn_k(self):
        knn_k = round(self.data_num * self.knn_k_ratio)
        if knn_k < 6:
            knn_k = 6
        return knn_k
    
    def get_subs(self):
        if self.output_subs is None:
            return self._sample_subs()
        else:
            return self._process_output_subs()
    
    def _process_output_subs(self):
        binary_subs = []

        for sub in self.output_subs:
            binary_sub = '0' * self.dim_num
            dims = sub.split('_')
            for dim in dims:
                dimIdx = int(dim) - 1
                binary_sub = binary_sub[:dimIdx] + "1" + binary_sub[dimIdx + 1:]
            binary_subs.append(binary_sub)
        
        sorted_binary_subs = []
        all_subs = self._sample_all_subs()
        all_binary_subs = self._get_binary_subs(all_subs)
        for binary_sub in all_binary_subs:
            if binary_sub in binary_subs:
                sorted_binary_subs.append(binary_sub)
        
        return sorted_binary_subs

    def _sample_subs(self):
        """Equal probability sampling

        We would like to solve scalability issues by sampling. We apply the equal 
        probability sampling in order to ensure the diversity and representativeness 
        of the samples.
        - The sampling frequency for each dimension remains the same.
        - The calculation of the number of subspaces is a combinatorial problem. We 
        want to keep the proportion of the number of subspaces with different dimensions 
        after sampling.

        The sampled subspaces are stored as binary code
        """
        if self.sample_type == 'all':
            subs = self._sample_all_subs()
        elif self.sample_type == 'partial':
            subs = self._sample_some_subs()
        subs = self._get_binary_subs(subs)
        return subs

    def _sample_all_subs(self):
        subs = self._sampel_all_subs_except_whole_dim_sub()
        subs += [self.dims]
        return subs

    def _sample_some_subs(self):
        # random.seed(6)
        # subs = self._sampel_all_subs_except_whole_dim_sub()
        # sample_size = round(len(subs) * self.sample_rate)
        # sampled_subs = [subs[i] for i in sorted(random.sample(range(len(subs)), sample_size))]
        # sampled_subs += [self.dims]

        random.seed(7)
        sampled_subs = []
        # do not involve the whole-dimension subspace
        all_sub_num = math.pow(2, self.dim_num) - self.dim_num - 2
        total_sample_size = round(all_sub_num * self.sample_rate)
        subs_by_dim_num = []
        sample_acc_probs_by_dim_num = [0]
        sample_size_by_dim_num = []
        for i in range(2, self.dim_num):
            subs_by_dim_num.append(list(combinations(self.dims, i)))
            sample_size_by_dim_num.append(0)
            if i == self.dim_num - 1:
                sample_acc_probs_by_dim_num.append(1)
                break
            sub_num = int(comb(self.dim_num, i))
            curr_acc_prob = sample_acc_probs_by_dim_num[len(sample_acc_probs_by_dim_num) - 1]
            sample_acc_probs_by_dim_num.append(curr_acc_prob + sub_num / all_sub_num)
        for i in range(total_sample_size):
            rand = random.random()
            for j, acc_prob in enumerate(sample_acc_probs_by_dim_num):
                if acc_prob > rand:
                    sample_size_by_dim_num[j - 1] += 1
                    break
        for i, sample_size in enumerate(sample_size_by_dim_num):
            sampled_subs += [subs_by_dim_num[i][j] for j in sorted(random.sample(range(len(subs_by_dim_num[i])), sample_size))]
        sampled_subs += [self.dims]

        return sampled_subs
    
    def _sampel_all_subs_except_whole_dim_sub(self):
        subs = []
        for i in range(2, self.dim_num):
            subs += list(combinations(self.dims, i))
        subs = [list(sub) for sub in subs]
        return subs

    def _get_binary_subs(self, subs):
        binary_subs = []
        for sub in subs:
            binary_sub = self._transform2binary(sub)
            binary_subs.append(binary_sub)
        return binary_subs

    def _transform2binary(self, sub):
        binary_sub = ''
        for dim in self.dims:
            if dim in sub:
                binary_sub += '1'
            else:
                binary_sub += '0'
        return binary_sub

    def get_subs_items_knn(self):
        """ Calculate the K nearest neighbors for each data item in each subspace

        Output: an object with #subspaces keys, where each value is a 2d np array (#items * self.knn_k)
        """
        subs_items_knn = {}
        for sub in self.subs:
            decoded_sub = self._decode_binary_sub(sub)
            sub_data = self.data.loc[:, self.data.columns.isin(decoded_sub)]
            sub_values = sub_data.to_numpy()
            # Remove the subspace itself from its knn,
            # so we need to calculate its(knn + 1) neighbors
            nbrs = NearestNeighbors(n_neighbors=(self.knn_k + 1), algorithm='ball_tree').fit(sub_values)
            _, indices = nbrs.kneighbors(sub_values)
            sub_knn = np.zeros((len(indices), self.knn_k))
            for i in range(len(indices)):
                if i in indices[i]:
                    idx = np.where(indices[i] == i)
                    sub_knn[i] = np.delete(indices[i], idx)
                else:
                    sub_knn[i] = indices[i][:self.knn_k]
            subs_items_knn[sub] = sub_knn
        return subs_items_knn

    def _decode_binary_sub(self, binary_sub):
        sub = []
        for i, binary in enumerate(binary_sub):
            if binary == '1':
                sub.append(self.dims[i])
        return sub

    def get_pairwise_subs_items_dist_df(self):
        """ Calculate the distance on each datum between any two subspaces
        """
        # file_path = os.path.join(self.parent_dir, 'pairwise_subs_items_dist.csv')
        file_path2 = os.path.join(self.parent_dir, 'pairwise_subs_items_dist.txt')
        # finally use txt due to its high efficiency
        if os.path.isfile(file_path2):
        # if os.path.isfile(file_path):
            # start_time = datetime.now()
            # raw_pairwise_subs_items_dist_df = pd.read_csv(file_path)
            # end_time = datetime.now()
            # print('finish pairwise_subs_items_dist_df reading, cost', (end_time - start_time).seconds, 'seconds')
            # print('------------------------------------------------')
            # start_time = datetime.now()
            # raw_pairwise_subs_items_dist_df.index = self.subs
            # pairwise_subs_items_dist_df = raw_pairwise_subs_items_dist_df.applymap(self._convert_list_str_2_list)
            # end_time = datetime.now()
            # print('finish pairwise_subs_items_dist_df conversion, cost', (end_time - start_time).seconds, 'seconds')
            start_time = datetime.now()
            with open (file_path2, 'rb') as fp:
                pairwise_subs_items_dist_mat = pickle.load(fp)
                pairwise_subs_items_dist_df = pd.DataFrame(pairwise_subs_items_dist_mat, index=self.subs, columns=self.subs)
            end_time = datetime.now()
            print('finish pairwise_subs_items_dist_df reading, cost', (end_time - start_time).seconds, 'seconds')
        else:
            pairwise_subs_items_dist_df = pd.DataFrame([], index=self.subs, columns=self.subs)
            for i, sub0 in enumerate(tqdm(self.subs)):
                for j in range(i, self.sub_num):
                    # print('Processing', (i + 1), '/', self.sub_num, 'subspaces', (j + 1), '/', self.sub_num, 'calculations')
                    if i == j:
                        pairwise_subs_items_dist_df.iloc[i, j] = [0] * self.data_num
                        continue
                    sub1 = self.subs[j]
                    two_subs_items_dist_list = self._get_two_subs_items_dist_list(self.subs_items_knn[sub0],
                                                                                self.subs_items_knn[sub1])
                    pairwise_subs_items_dist_df.loc[sub0, sub1] = two_subs_items_dist_list
                    pairwise_subs_items_dist_df.loc[sub1, sub0] = two_subs_items_dist_list
            # pairwise_subs_items_dist_df.to_csv(file_path, index=False)
            pairwise_subs_items_dist_mat = pairwise_subs_items_dist_df.to_numpy().tolist()
            with open(file_path2, 'wb') as fp:
                pickle.dump(pairwise_subs_items_dist_mat, fp)
        return pairwise_subs_items_dist_df

    def _convert_list_str_2_list(self, x):
        return ast.literal_eval(x)

    def _get_two_subs_items_dist_list(self, sub0_items_knn, sub1_items_knn):
        two_subs_items_dist_list = []
        for item_knn0, item_knn1 in zip(sub0_items_knn, sub1_items_knn):
            two_subs_items_dist_list.append(1 - self._jaccard_dist(item_knn0, item_knn1))
        return two_subs_items_dist_list

    def _jaccard_dist(self, arr0, arr1):
        intersection_num = len(np.intersect1d(arr0, arr1))
        union_num = len(np.union1d(arr0, arr1))
        return intersection_num / union_num

    def get_subs_dist_df(self):
        file_path = os.path.join(self.parent_dir, 'subs_dist.txt')
        if os.path.isfile(file_path):
            start_time = datetime.now()
            with open (file_path, 'rb') as fp:
                subs_dist_mat = pickle.load(fp)
                subs_dist_df = pd.DataFrame(subs_dist_mat, index=self.subs, columns=self.subs)
            end_time = datetime.now()
            print('finish subs_dist_df reading, cost', (end_time - start_time).seconds, 'seconds')
        else:
            subs_dist_df = pd.DataFrame(0, index=self.subs, columns=self.subs)
            for i, sub0 in enumerate(self.subs):
                for j in range(i + 1, self.sub_num):
                    sub1 = self.subs[j]
                    # sub_dist = self._get_sub_dist(self.subs_items_knn[sub0], self.subs_items_knn[sub1])
                    sub_dist = mean(self.pairwise_subs_items_dist_df.loc[sub0, sub1])
                    subs_dist_df.loc[sub0, sub1] = sub_dist
                    subs_dist_df.loc[sub1, sub0] = sub_dist
            subs_dist_mat = subs_dist_df.to_numpy().tolist()
            with open(file_path, 'wb') as fp:
                pickle.dump(subs_dist_mat, fp)
        return subs_dist_df

    # def _get_sub_dist(self, knn0, knn1):
    #     num = len(knn0)
    #     sub_dist = 0
    #     for i in range(num):
    #         sub_dist += 1 - self._jaccard_dist(knn0[i], knn1[i])
    #     sub_dist /= num
    #     return sub_dist

    def draw_subs_proj(self, type):
        subs_proj = list(self._get_subs_proj().values())
        x = []
        y = []
        for coords in subs_proj:
            x.append(coords[0])
            y.append(coords[1])
        plt.scatter(x, y)
        plt.title('Projection of %s subspace distance matrix' %type)
        fig_dir = os.path.join(self.parent_dir, '%s.png' %type)
        plt.savefig(fig_dir)
        plt.close()

    def draw_subs_dist_mat(self, type):
        dist_mat = np.copy(self.subs_dist_df.to_numpy())
        # n = dist_mat.shape[0]
        sorted_dist_mat = self._sort_mat_row_and_col_wise(dist_mat)
        ax = sns.heatmap(sorted_dist_mat, cmap='Reds', xticklabels=False, yticklabels=False)
        ax.set_title('Heatmap of %s subspace distance matrix' %type)
        fig = ax.get_figure()
        fig_dir = os.path.join(self.parent_dir, '%s.png' %type)
        fig.savefig(fig_dir, dpi=300)
        fig.clf()
    
    def _sort_mat_row_and_col_wise(self, mat):
        # sort rows of mat[][]
        sorted_mat = np.sort(mat, axis=1)
        # get transpose of mat[][]
        sorted_mat = np.transpose(sorted_mat)
        # again sort rows of mat[][]
        sorted_mat = np.sort(sorted_mat, axis=1)
        # again get transpose of mat[][]
        sorted_mat = np.transpose(sorted_mat)
        return sorted_mat

    def get_subs_k_neighbors(self):
        subs_k_neighbors = {}
        for sub in self.subs:
            sub_dist_vec = self.subs_dist_df.loc[:, sub].to_numpy()
            # sub_k_neighbor_ids = list(np.argsort(sub_dist_vec)[1:self.sub_k + 1])
            # subs_k_neighbors[sub] = [self.subs[id] for id in sub_k_neighbor_ids]
            subs_k_neighbors[sub] = list(np.argsort(sub_dist_vec)[1:self.sub_k + 1])
            subs_k_neighbors[sub] = [int(item) for item in subs_k_neighbors[sub]]
            if sub in subs_k_neighbors[sub]:
                print('sub in its neighbors', sub, subs_k_neighbors[sub])
        return subs_k_neighbors

    def get_subs_items_k_dist(self):
        """Average similarities on each datum for each subspace -- #subspaces (row) * #items (col)

        For each data item, calculate the average of the similarity of the k nearest subspaces of the 
        subspace on the corresponding data item.
        """
        subs_items_k_dist = {}
        for sub in self.subs:
            subs_items_k_dist[sub] = []
            for i in range(self.data_num):
                item_k_dist_list = []
                for neighbbor_sub in self.subs_k_neighbors[sub]:
                    # item_k_dist_list.append(self.pairwise_subs_items_dist_df.loc[sub, neighbbor_sub][i])
                    item_k_dist_list.append(self.pairwise_subs_items_dist_df.loc[sub, self.subs[neighbbor_sub]][i])
                subs_items_k_dist[sub].append(mean(item_k_dist_list))
        return subs_items_k_dist

    def get_subs_color(self):
        """Assign a color to each subspace
        
        We project the subspace distance matrix into the 3D space through MDS. 
        Each dimension in the three-dimensional space represents one of the RGB values.
        """
        return self._get_subs_proj(dimensions=3)

    def _get_subs_proj(self, dimensions=2):
        X = self.subs_dist_df.to_numpy()
        embedding = MDS(n_components=dimensions, dissimilarity="precomputed", random_state=6)
        Y = embedding.fit_transform(X)
        scaler = MinMaxScaler()
        Y = scaler.fit_transform(Y)
        Y = Y.tolist()
        subs_proj = dict(zip(self.subs, Y))
        return subs_proj
    
    def _get_subs_tsne(self, dimensions=2):
        X = self.subs_dist_df.to_numpy()
        embedding = TSNE(n_components=dimensions, metric="precomputed", random_state=6)
        Y = embedding.fit_transform(X)
        scaler = MinMaxScaler()
        Y = scaler.fit_transform(Y)
        Y = Y.tolist()
        subs_proj = dict(zip(self.subs, Y))
        return subs_proj

    def get_proj_subs_dist_df(self):
        """Get the distance matrix of 3D projected subspaces which are used to represent RGB values in the map.
        """
        subs_coords = list(self.subs_color.values())
        # subs_coords = list(self.subs_proj.values())
        proj_subs_dist_mat = distance_matrix(subs_coords, subs_coords)
        return pd.DataFrame(proj_subs_dist_mat, index=self.subs, columns=self.subs)

    def get_subs_hier_clusters(self):
        curr_cluster_level = 0
        subs_hier_clusters = self._get_hier_DBSCAN(self.subs, self.subs_dist_df, curr_cluster_level)
        return subs_hier_clusters

    def _get_hier_DBSCAN(self, subs, subs_dist_df, curr_cluster_level):
        if len(subs) < self.min_cluster_size:
            return subs
        if curr_cluster_level >= self.max_cluster_level:
            return subs
        min_pts = self._get_min_pts(subs)
        eps = self._get_eps(subs_dist_df, min_pts)
        # If metric is "precomputed", X is assumed to be a distance matrix and must be square
        # 这里square应该是方阵，而不是平方的意思
        # a square matrix is a matrix with the same number of rows and columns
        X = subs_dist_df.to_numpy()
        clustering = DBSCAN(eps=eps, min_samples=min_pts, metric='precomputed').fit(X)
        labels = clustering.labels_
        clusters = self._get_clusters(subs, labels)
        for i, cluster in enumerate(clusters):
            if isinstance(cluster, list):
                this_subs_dist_df = subs_dist_df.loc[cluster, cluster]
                clusters[i] = self._get_hier_DBSCAN(cluster, this_subs_dist_df, curr_cluster_level + 1)
        return clusters

    def _get_clusters(self, subs, labels):
        clusters = []

        # get length of unique values from labels except outliers
        labels_num = len(list(set(labels)))
        if -1 in labels:
            labels_num -= 1

        for i in range(labels_num):
            clusters.append([])
        for label, sub in zip(labels, subs):
            if label != -1:
                clusters[label].append(sub)
            else:
                clusters.append(sub)
        return clusters

    def _get_min_pts(self, subs):
        """DBSCAN parameter minPts estimation

        minPts specifies how many neighbors a point should have to be included into a cluster.

        I set it to the number of subspaces divided by 8.
        """
        min_pts = round(len(subs) * self.min_pts_ratio[self.dataset])
        if min_pts < self.min_min_pts:
            min_pts = self.min_min_pts
        print('min_pts = %d' % min_pts)
        return min_pts

    def _get_eps(self, subs_dist_df, min_pts):
        """DBSCAN parameter eps estimation

        eps specifies how close points should be to each other to be considered a part of a cluster.

        The value can be chosen by using a k-distance graph, plotting the distance to 
        the k = minPts-1 nearest neighbor ordered from the largest to the smallest value.

        In our application, the larger value is, the more similar two subspaces are. So I set it to 
        the average of the minPts - 1 small similarity between each subspace and the other subspaces.
        """
        # need deep copy
        subs_dist_mat = np.copy(subs_dist_df.to_numpy())
        subs_dist_mat.sort(axis=0)
        subs_dist_vec = subs_dist_mat[min_pts - 1]
        eps = subs_dist_vec.mean()
        print('eps = %f' % eps)
        return eps

    def get_subs_cluster_index_df(self):
        subs_cluster_index_df = pd.DataFrame(-1, index=self.subs, columns=list(range(self.max_cluster_level + 1)))
        subs_cluster_index = list(self._get_sub_cluster_index(self.subs_hier_clusters, []))
        for sub_cluster_index in subs_cluster_index:
            for i in range(len(sub_cluster_index[0])):
                subs_cluster_index_df.loc[sub_cluster_index[1], i] = sub_cluster_index[0][i]
                subs_cluster_index_df.loc[sub_cluster_index[1], self.max_cluster_level] = -1
        return subs_cluster_index_df

    def _get_sub_cluster_index(self, this_cluster, prev_index):
        sub_cluster_num = self._get_sub_cluster_num(this_cluster)
        for i in range(sub_cluster_num, len(this_cluster)):
            yield ((prev_index, this_cluster[i]))
        for i in range(sub_cluster_num):
            curr_index = deepcopy(prev_index)
            curr_index.append(i)
            this_sub_cluster = this_cluster[i]
            some_subs_cluster_index = list(self._get_sub_cluster_index(this_sub_cluster, curr_index))
            for sub_cluster_index in some_subs_cluster_index:
                yield sub_cluster_index

    def _get_sub_cluster_num(self, cluster):
        num = len(cluster)
        for sub_cluster in cluster:
            if not isinstance(sub_cluster, list):
                num -= 1
        return num

    def init_tree(self):
        curr_sub_num = self.sub_num
        path2root = []
        path2leaves = self.subs_cluster_index_df
        leaves_index = {}
        for i in range(curr_sub_num):
            leaves_index[i] = i
        return self._init_tree(path2root, 0, path2leaves, leaves_index, True)

    def _init_tree(self, path2parent, cluster_id, path2leaves, leaves_index, is_root=False):
        subtree = {}
        path2this = self._get_path2this(path2parent, cluster_id, is_root)
        leaf_num = path2leaves.shape[0]
        curr_depth = path2leaves.shape[1]
        child2leaves = path2leaves.iloc[:, 0]
        children_path2leaves = {}
        children_leaves_index = {}
        leaf_index2child = {}
        leaf_index2id = {}
        leaves = []
        leaves_traversal_order = []
        children = []
        children_traversal_order = []
        for leaf_id in range(leaf_num):
            # child_cluster_id:
            #   -1: the child is a leaf node
            #   >-1: the child is a sub-cluster node
            child_cluster_id = child2leaves.iloc[leaf_id]
            leaf_index = leaves_index[leaf_id]
            leaf_index2child[leaf_index] = child_cluster_id
            leaf_index2id[leaf_index] = leaf_id
            if child_cluster_id < 0 or curr_depth == 1:
                # this child itself is a leaf, i.e., a direct child
                leaves.append(leaf_index)
                leaves_traversal_order.append(leaf_index)
            else:
                # this child is a sub-cluster, i.e., not a direct child
                child_path2leaf = path2leaves.iloc[leaf_id, 1:curr_depth].tolist()
                if child_cluster_id not in children_path2leaves:
                    # path2leaves and index of this child do not exist yet
                    child_leaf_id = 0
                    # handle path2leaves of this child
                    children_path2leaves[child_cluster_id] = pd.DataFrame([child_path2leaf])
                    # handle element indices
                    child_leaves_index = {}
                    child_leaves_index[child_leaf_id] = leaf_index
                    children_leaves_index[child_cluster_id] = child_leaves_index
                else:
                    # path2leaves and index of this child already exist
                    child_leaf_id = len(children_path2leaves[child_cluster_id])
                    # handle path2leaves of this child
                    children_path2leaves[child_cluster_id].loc[child_leaf_id] = child_path2leaf
                    # handle element indices
                    children_leaves_index[child_cluster_id][child_leaf_id] = leaf_index
        if not children_path2leaves:
            # all leaf nodes are direct children, i.e., no sub-clusters
            is_btm_tree = True
        else:
            # it has sub-clusters
            is_btm_tree = False
            child_num = max(children_path2leaves) + 1
            if child_num > 0:
                for child_cluster_id in range(child_num):
                    # create a tree for each child
                    child_path2leaves = children_path2leaves[child_cluster_id]
                    child_leaves_index = children_leaves_index[child_cluster_id]
                    children.append(self._init_tree(path2this, child_cluster_id, child_path2leaves, child_leaves_index))
                    children_traversal_order.append(child_cluster_id)
        subtree['node_ready'] = False
        subtree['is_root'] = is_root
        subtree['is_btm_tree'] = is_btm_tree
        subtree['path2this'] = path2this
        subtree['leaf_index2child'] = leaf_index2child
        subtree['leaf_index2id'] = leaf_index2id
        subtree['leaves'] = leaves
        subtree['leaves_traversal_order'] = leaves_traversal_order
        # "node" did not add to subtree yet
        subtree['children_traversal_order'] = children_traversal_order
        subtree['children'] = children
        # subtree['node'] = None
        return subtree
    
    # def init_subtree_node(self, is_top_child, subs, subs_dist_df, subs_items_k_dist, global_traversal_order):
    def init_subtree_node(self, is_top_child, subs, subs_dist_df, subs_items_k_dist, global_traversal_order=[]):
        subtree_node = {}
        # added it myself, in order to pass parameters
        subtree_node['is_top_child'] = is_top_child
        subtree_node['subs'] = subs
        subtree_node['subs_items_k_dist'] = subs_items_k_dist
        subtree_node['sub_num'] = len(subs)
        subtree_node['dim_num'] = len(subs[0])
        subtree_node['data_num'] = len(subs_items_k_dist[subs[0]])
        # whether it is the root node
        subtree_node['is_root'] = len(subs) == subs_dist_df.shape[0]
        # aggr_dims: the aggregated dimension count
        subtree_node['aggr_dims'] = [0] * subtree_node['dim_num']
        # aggr_items_dist: the aggregated similarity of data
        subtree_node['aggr_items_dist'] = [0] * subtree_node['data_num']
        # aggr_elem_num: 0, the overall number of leaf nodes in this tree
        subtree_node['aggr_elem_num'] = 0
        subtree_node['center_vec'] = [-1, -1]
        # global traversal order for the top-level subtree
        subtree_node['self_global_traversal_order'] = []
        # global traversal order for all leafs (leaf_indices), only stored for the top-level subtrees
        subtree_node['global_traversal_order'] = global_traversal_order
        subtree_node['dsc_dist_df'] = pd.DataFrame([0])
        subtree_node['center'] = {
            'is_child': None,
            'child_cluster_id': None,
            'leaf_index': None
        }
        subtree_node['dsc_traversal_order'] = pd.DataFrame([0])
        # currently, each city is linked to its 'childNetwork_k' nearest neighbors
        # col_0: [child_cluster_id or leaf_index], col_n: the n-th nearest neighbor
        subtree_node['child_network'] = pd.DataFrame([0])
        # child_network_is_child: the 'isChild' signs for the 'childNetwork' matrix
        subtree_node['child_network_is_child'] = pd.DataFrame([0])
        return subtree_node
    
    def build_subtree_node(self, subtree, subtree_node):
        if not subtree['node_ready']:
            # step 1: decide the traversal order among descendants
            # 1) set the default descendant order
            child_num = len(subtree['children'])
            leaf_num = len(subtree['leaves'])
            dsc_num = child_num + leaf_num
            child_signs = [0] * child_num
            leaf_signs = [-1] * leaf_num
            # default order: children first, then leaves
            dsc_order = subtree['children_traversal_order'] + subtree['leaves_traversal_order']
            dsc_signs = child_signs + leaf_signs
            # 2) get the updated descendant order
            # cluster_id_index
            leaf_indices_in_children = {}
            for child_cluster_id in range(child_num):
                child_leaf_index2child = subtree['children'][child_cluster_id]['leaf_index2child']
                leaf_indices_in_child = list(child_leaf_index2child.keys())
                leaf_indices_in_children[child_cluster_id] = leaf_indices_in_child
            self._get_traversal_order(subtree_node, leaf_indices_in_children, subtree['leaves'], dsc_order, dsc_signs)

            # step 2: go through all descendants to collect the information
            for traversal_id in range(dsc_num):
                if dsc_signs[traversal_id] == 0:
                    # it is a child
                    # bulid the super node for each child (subtree)
                    # get the child cluster id by the traversal order
                    child_cluster_id = dsc_order[traversal_id]
                    leaf_indices_in_child = leaf_indices_in_children[child_cluster_id]
                    leaf_ids_in_child = []
                    for i in range(len(leaf_indices_in_child)):
                        leaf_ids_in_child.append(subtree['leaf_index2id'][leaf_indices_in_child[i]])
                    child_subtree_node = self._inherit_subtree_node(leaf_ids_in_child, subtree_node)
                    # prepare the super node of this child
                    self.build_subtree_node(subtree['children'][child_cluster_id], child_subtree_node)
                    # aggregate: retrieve the node of this child
                    self._aggregate_subtree_node(child_cluster_id, subtree_node, child_subtree_node)
                else:
                    # it is a direct leaf
                    # collect: get the information of a leaf
                    leaf_index = dsc_order[traversal_id]
                    leaf_id = subtree['leaf_index2id'][leaf_index]
                    self._collect_subtree_node(leaf_id, leaf_index, subtree_node)
            
            # step 3: summarize all collected information
            subtree['node_ready'] = True

            subtree['index'] = subtree.pop('path2this')
            subtree['data'] = {}
            subtree['data']['aggrNum'] = subtree_node['aggr_elem_num']
            subtree['data']['centerLeafName'] = subtree_node['center_vec']
            subtree['data']['childNetwork'] = subtree_node['child_network'].values.tolist()
            subtree['data']['childNetworkSigns'] = subtree_node['child_network_is_child'].values.tolist()
            if len(subtree['data']['childNetwork'][0]) == 1:
                subtree['data']['childNetwork'] = []
                subtree['data']['childNetworkSigns'] = []
            subtree['data']['dataWeights'] = subtree_node['aggr_items_dist']
            if subtree_node['is_root']:
                # subtree['data']['dscDistMat'] = subtree_node['dsc_dist_df'].values.tolist()
                subtree['data']['initProjection'] = []
                for child in subtree['children']:
                    subtree['data']['initProjection'].append(self.subs_proj[self.subs[child['data']['centerLeafName'][0]]])
                for leaf in subtree['leaves']:
                    subtree['data']['initProjection'].append(self.subs_proj[self.subs[leaf]])
            else:
                subtree['data']['dscDistMat'] = []
            subtree['data']['dscTraversalOrder'] = subtree_node['dsc_traversal_order'].values.tolist()
            if subtree_node['is_top_child']:
                subtree['data']['glbTraversalOrder'] = subtree_node['self_global_traversal_order']
                subtree['data']['glbTraversalOrder'] = [int(item) for item in subtree['data']['glbTraversalOrder']]
            else:
                subtree['data']['glbTraversalOrder'] = []
            subtree['data']['dimCounts'] = subtree_node['aggr_dims']
            subtree['dict'] = [list(elem) for elem in list(subtree.pop('leaf_index2child').items())]
            for lst in subtree['dict']:
                lst[1] = int(lst[1])
            subtree.pop('node_ready')
            subtree.pop('is_root')
            subtree.pop('is_btm_tree')
            subtree.pop('leaf_index2id')
            subtree.pop('leaves_traversal_order')
            subtree.pop('children_traversal_order')
    
    def _get_traversal_order(self, subtree_node, leaf_indices_in_children, leaves, dsc_order, dsc_signs):
        child_num = len(leaf_indices_in_children)
        leaf_num = len(leaves)
        dsc_num = child_num + leaf_num
        # self_global_traversal_order = []
        # global_traversal_order = []
        t_global_traversal_order = subtree_node['self_global_traversal_order'] if subtree_node['is_top_child'] else subtree_node['global_traversal_order']
        former_num = len(t_global_traversal_order)
        # sum_dsc_dist_df: summed distances between the descendants -- order: [ all_children, all_leaves ]
        sum_dsc_dist_df = pd.DataFrame(0, index=range(dsc_num), columns=range(dsc_num))
        dsc_dist_np = subtree_node['dsc_dist_df'].to_numpy().copy()
        dsc_dist_np.resize(dsc_num, dsc_num)
        subtree_node['dsc_dist_df'] = pd.DataFrame(dsc_dist_np)
        centroid_leaves = [-1] * dsc_num
        avg_dsc_dist_df = pd.DataFrame(0, index=[0], columns=range(dsc_num))
        # count the amount of all leaves
        all_leaves_num = 0
        count_ready = False
        min_dsc_dist_df = pd.DataFrame(0, index=range(dsc_num), columns=range(dsc_num))
        # child-to-child and child-to-leaf distances
        for child_cluster_id_i in range(child_num):
            child_i_leaf_indices = leaf_indices_in_children[child_cluster_id_i]
            i_leaf_indices = deepcopy(child_i_leaf_indices)
            if not count_ready:
                all_leaves_num = len(child_i_leaf_indices)
            centroid_i = centroid_leaves[child_cluster_id_i]
            # get the centroid
            if centroid_i == -1:
                child_leaf_dist_np = self.subs_dist_df.iloc[i_leaf_indices, i_leaf_indices].to_numpy()
                col_mean = child_leaf_dist_np.mean(0)
                centroid_i = i_leaf_indices[col_mean.argmin()]
                centroid_leaves[child_cluster_id_i] = centroid_i
            # part 0: self-to-self distances
            sum_dsc_dist_df.iloc[child_cluster_id_i, child_cluster_id_i] = self.subs_dist_df.iloc[i_leaf_indices, i_leaf_indices].to_numpy().sum()
            subtree_node['dsc_dist_df'].iloc[child_cluster_id_i, child_cluster_id_i] = 0
            min_dsc_dist_df.iloc[child_cluster_id_i, child_cluster_id_i] = 0
            # part 1: child-to-child distances
            for child_cluster_id_j in range(child_cluster_id_i + 1, child_num):
                child_j_leaf_indices = leaf_indices_in_children[child_cluster_id_j]
                j_leaf_indices = deepcopy(child_j_leaf_indices)
                centroid_j = centroid_leaves[child_cluster_id_j]
                # get the centroid
                if centroid_j == -1:
                    child_leaf_dist_np = self.subs_dist_df.iloc[j_leaf_indices, j_leaf_indices].to_numpy()
                    col_mean = child_leaf_dist_np.mean(0)
                    centroid_j = j_leaf_indices[col_mean.argmin()]
                    centroid_leaves[child_cluster_id_j] = centroid_j
                # get the summed distance
                sum_dist_ij = self.subs_dist_df.iloc[i_leaf_indices, j_leaf_indices].sum().sum()
                sum_dsc_dist_df.iloc[child_cluster_id_i, child_cluster_id_j] = sum_dist_ij
                sum_dsc_dist_df.iloc[child_cluster_id_j, child_cluster_id_i] = sum_dist_ij
                # get the centroid distance
                dist_ij = self.subs_dist_df.iloc[centroid_i, centroid_j]
                subtree_node['dsc_dist_df'].iloc[child_cluster_id_i, child_cluster_id_j] = dist_ij
                subtree_node['dsc_dist_df'].iloc[child_cluster_id_j, child_cluster_id_i] = dist_ij
                # get the shortest distance
                # from i to j
                min_dist_ij = self.subs_dist_df.iloc[i_leaf_indices, j_leaf_indices].min(1).mean()
                min_dsc_dist_df.iloc[child_cluster_id_i, child_cluster_id_j] = min_dist_ij
                # from j to i
                min_dist_ji = self.subs_dist_df.iloc[j_leaf_indices, i_leaf_indices].min(1).mean()
                min_dsc_dist_df.iloc[child_cluster_id_j, child_cluster_id_i] = min_dist_ji
                # count the leaves
                if not count_ready:
                    all_leaves_num += len(child_j_leaf_indices)
            # part 2: child-to-leaf distances
            for leaf_id_j in range(leaf_num):
                global_id_j = child_num + leaf_id_j
                j_leaf_index = leaves[leaf_id_j]
                centroid_j = centroid_leaves[global_id_j]
                if centroid_j == -1:
                    centroid_j = j_leaf_index
                    centroid_leaves[global_id_j] = centroid_j
                # get the summed distance
                # sum_dist_ij = self.subs_dist_df.iloc[i_leaf_indices, j_leaf_index].to_numpy().sum()
                sum_dist_ij = self.subs_dist_df.iloc[i_leaf_indices, j_leaf_index].sum()
                sum_dsc_dist_df.iloc[child_cluster_id_i, global_id_j] = sum_dist_ij
                sum_dsc_dist_df.iloc[global_id_j, child_cluster_id_i] = sum_dist_ij
                # get the centroid distance
                dist_ij = self.subs_dist_df.iloc[centroid_i, centroid_j]
                subtree_node['dsc_dist_df'].iloc[child_cluster_id_i, global_id_j] = dist_ij
                subtree_node['dsc_dist_df'].iloc[global_id_j, child_cluster_id_i] = dist_ij
                # get the shortest distance
                # min_dist_ij = self.subs_dist_df.iloc[i_leaf_indices, j_leaf_index].to_numpy().min(1).mean()
                min_dist_ij = self.subs_dist_df.iloc[i_leaf_indices, j_leaf_index].mean()
                min_dsc_dist_df.iloc[child_cluster_id_i, global_id_j] = min_dist_ij
                # min_dist_ji = self.subs_dist_df.iloc[j_leaf_index, i_leaf_indices].to_numpy().min(1).mean()
                min_dist_ji = self.subs_dist_df.iloc[j_leaf_index, i_leaf_indices].mean()
                min_dsc_dist_df.iloc[global_id_j, child_cluster_id_i] = min_dist_ji
                # count the leaves
                if not count_ready:
                    all_leaves_num += 1
            count_ready = True
            # deal with the avgDcdDistance vector
            avg_dsc_dist_df.iloc[0, child_cluster_id_i] = sum_dsc_dist_df.iloc[:, child_cluster_id_i].sum() / (len(child_i_leaf_indices) * all_leaves_num)
        # part 3: leaf-to-leaf distances
        for leaf_id_i in range(leaf_num):
            global_id_i = child_num + leaf_id_i
            sum_dsc_dist_df.iloc[global_id_i, global_id_i] = 0
            subtree_node['dsc_dist_df'].iloc[global_id_i, global_id_i] = 0
            min_dsc_dist_df.iloc[global_id_i, global_id_i] = 0
            for leaf_id_j in range(leaf_id_i + 1, leaf_num):
                global_id_j = child_num + leaf_id_j
                # get the summed distance
                sum_dist_ij = self.subs_dist_df.iloc[leaves[leaf_id_i], leaves[leaf_id_j]]
                sum_dsc_dist_df.iloc[global_id_i, global_id_j] = sum_dist_ij
                sum_dsc_dist_df.iloc[global_id_j, global_id_i] = sum_dist_ij
                # get the centroid distance
                dist_ij = sum_dist_ij
                subtree_node['dsc_dist_df'].iloc[global_id_i, global_id_j] = dist_ij
                subtree_node['dsc_dist_df'].iloc[global_id_j, global_id_i] = dist_ij
                # get the shortest distance
                min_dist_ij = dist_ij
                min_dsc_dist_df.iloc[global_id_i, global_id_j] = min_dist_ij
                min_dist_ji = dist_ij
                min_dsc_dist_df.iloc[global_id_j, global_id_i] = min_dist_ji
            # deal with the avgDcdDistance vector
            avg_dsc_dist_df.iloc[0, global_id_i] = sum_dsc_dist_df.iloc[:, global_id_i].sum() / (1 * all_leaves_num)

        # min_dsc2former_dist_df: distances from the descendants to the formers
        if former_num > 0:
            min_dsc2former_dist_df = pd.DataFrame(0, index=range(dsc_num), columns=[0])
            # part 1: child-to-former distances
            for child_cluster_id in range(child_num):
                child_i_leaf_indices = leaf_indices_in_children[child_cluster_id_i]
                i_leaf_indices = deepcopy(child_i_leaf_indices)
                min_dist = self.subs_dist_df.iloc[i_leaf_indices, t_global_traversal_order].min(1).mean()
                min_dsc2former_dist_df.iloc[child_cluster_id, 0] = min_dist
            # part 2: leaf-to-former distances
            for leaf_id in range(leaf_num):
                leaf_index = leaves[leaf_id]
                min_dist = self.subs_dist_df.iloc[leaf_index, t_global_traversal_order].min()
                min_dsc2former_dist_df.iloc[child_num + leaf_id, 0] = min_dist
        
        # city map
        # 1. center: the descendant with the shortest avg distance
        # argmin: if there are only two descendants, or some distances are equal, just pick one
        if (subtree_node['is_root']):
            # print('child_num: ', child_num)
            # print('avg_dsc_dist_df: \n', avg_dsc_dist_df)
            avg_child_dist_df = avg_dsc_dist_df.iloc[:, :child_num]
            center_index_vec = avg_child_dist_df.to_numpy().argmin(1)
        else:
            center_index_vec = avg_dsc_dist_df.to_numpy().argmin(1)
        center_index = center_index_vec[0]
        if center_index < child_num:
            # the center is a child, i.e., a subtree
            subtree_node['center']['is_child'] = True
            # center_id: child_cluster_id or leaf_index
            center_id = center_index
            subtree_node['center']['child_cluster_id'] = center_id
            subtree_node['center']['leaf_index'] = -1
            subtree_node['center_vec'][1] = 0
        else:
            # the center is a leaf
            subtree_node['center']['is_child'] = False
            center_id = leaves[center_index - child_num]
            subtree_node['center']['child_cluster_id'] = -1
            subtree_node['center']['leaf_index'] = center_id
            subtree_node['center_vec'][1] = -1
        subtree_node['center_vec'][0] = center_id
        dsc_traversal_order_np = subtree_node['dsc_traversal_order'].to_numpy().copy()
        dsc_traversal_order_np.resize(dsc_num, 2)
        subtree_node['dsc_traversal_order'] = pd.DataFrame(dsc_traversal_order_np)
        # 2 & 3: traversal order
        if former_num == 0:
            # case 1: the center must be within this tree
            # this could be
            #   1) the root node; 2) the top-level subtree; 3) any subtree with a central parent
            # first deal with the center (which must contain the central leaf)
            subtree_node['dsc_traversal_order'].iloc[0, 0] = subtree_node['center_vec'][0]
            subtree_node['dsc_traversal_order'].iloc[0, 1] = subtree_node['center_vec'][1]
            # then deal with the others
            # case 1 step 1: prepare the existing list and the remaining list
            travel_existing = []
            travel_remaining = []
            for dsc_index in range(dsc_num):
                if dsc_index == center_index:
                    travel_existing.append(dsc_index)
                else:
                    travel_remaining.append(dsc_index)
            # case 1 step 2: decide the traversal order one by one
            for travel_order in range(1, dsc_num):
                # 1) prepare the distances between the existing and the remaining
                existing = deepcopy(travel_existing)
                remaining = deepcopy(travel_remaining)
                r2e_dist_df = min_dsc_dist_df.iloc[remaining, existing]
                # 2) find the nearest neighbor from the remaining list
                min_dist = r2e_dist_df.to_numpy().min(1)
                next_index_remaining = min_dist.argmin()
                next_index = travel_remaining[next_index_remaining]
                # 3) update two lists
                travel_existing.append(next_index)
                del travel_remaining[next_index_remaining]
                # 4) deal with the local descendant traversal order
                if next_index < child_num:
                    next_id = next_index
                    subtree_node['dsc_traversal_order'].iloc[travel_order, 1] = 0
                else:
                    next_id = leaves[next_index - child_num]
                    subtree_node['dsc_traversal_order'].iloc[travel_order, 1] = -1
                subtree_node['dsc_traversal_order'].iloc[travel_order, 0] = next_id
        else:
            # case 2: the center is not in this tree
            # case 2 step 1: prepare the existing list and the remaining list
            travel_existing = []
            travel_remaining = []
            for dsc_index in range(dsc_num):
                travel_remaining.append(dsc_index)
            # case 2 step 2: decide the traversal order one by one
            for travel_order in range(dsc_num):
                # 1). prepare the distances between the existing and the remaining
                existing = deepcopy(travel_existing)
                remaining = deepcopy(travel_remaining)
                # remaining to formers
                r2f_dist_df = min_dsc2former_dist_df.iloc[remaining]
                # remaining to existing
                r2e_dist_df = min_dsc_dist_df.iloc[remaining, existing]  
                if r2e_dist_df.empty:
                    r2ef_dist_df = r2f_dist_df
                else:
                    # r2ef_dist_df = r2f_dist_df.append(r2e_dist_df, ignore_index=True)
                    r2e_dist_df.columns = range(1, r2e_dist_df.shape[1] + 1)
                    r2ef_dist_df = r2f_dist_df.join(r2e_dist_df)
                # 2). find the nearest neighbor from the remaining list
                next_index_remaining = r2ef_dist_df.to_numpy().min(1).argmin()
                next_index = travel_remaining[next_index_remaining]
                # 3). update two lists
                travel_existing.append(next_index)
                del travel_remaining[next_index_remaining]
                # deal with the global descendant traversal order
                if next_index < child_num:
                    next_id = next_index
                    subtree_node['dsc_traversal_order'].iloc[travel_order, 1] = 0
                else:
                    next_id = leaves[next_index - child_num]
                    subtree_node['dsc_traversal_order'].iloc[travel_order, 1] = -1
                subtree_node['dsc_traversal_order'].iloc[travel_order, 0] = next_id
        # copy dsc_traversal_order to the vector
        dsc_order_len_diff = len(dsc_order) - dsc_num
        dsc_signs_len_diff = len(dsc_signs) - dsc_num
        if dsc_order_len_diff < 0:
            dsc_order += [0] * (-dsc_order_len_diff)
        elif dsc_order_len_diff > 0:
            for i in range(dsc_order_len_diff):
                dsc_order.pop(0)
        if dsc_signs_len_diff < 0:
            dsc_signs += [0] * (-dsc_signs_len_diff)
        elif dsc_signs_len_diff > 0:
            for i in range(dsc_signs_len_diff):
                dsc_signs.pop(0)
        for dsc_index in range(dsc_num):
            dsc_order[dsc_index] = subtree_node['dsc_traversal_order'].iloc[dsc_index, 0]
            dsc_signs[dsc_index] = subtree_node['dsc_traversal_order'].iloc[dsc_index, 1]
        # build up the traffic network for a non-bottom-level-tree
        is_btm = child_num == 0
        child_network_k = 1
        if not is_btm:
            # the number of nearest neighbors must not exceed the cluster size
            neighbor_num = child_network_k if child_network_k < dsc_num else dsc_num
            if neighbor_num < 1:
                neighbor_num = 1
            child_network_np = subtree_node['child_network'].to_numpy().copy()
            child_network_np.resize(dsc_num, neighbor_num + 1)
            subtree_node['child_network'] = pd.DataFrame(child_network_np)
            child_network_is_child_np = subtree_node['child_network_is_child'].to_numpy().copy()
            child_network_is_child_np.resize(dsc_num, neighbor_num + 1)
            subtree_node['child_network_is_child'] = pd.DataFrame(child_network_is_child_np)
            # find the nearest neighbors
            for dsc_index in range(dsc_num):
                is_child = dsc_index < child_num
                # col_0: dsc_id -- child_cluster_id or leaf_index
                dsc_id = dsc_index if is_child else leaves[dsc_index - child_num]
                subtree_node['child_network'].iloc[dsc_index, 0] = dsc_id
                subtree_node['child_network_is_child'].iloc[dsc_index, 0] = 0 if is_child else -1
                # sort the distances
                min_dsc_dist = min_dsc_dist_df.iloc[dsc_index].to_numpy()
                sorted_indices = np.argsort(min_dsc_dist, kind='stable')
                # put in the indices of the nearest neighbors
                for neighbor_order in range(1, neighbor_num):
                    neighbor_index = sorted_indices[neighbor_order]
                    neighbor_is_child = neighbor_index < child_num
                    neighbor_id = neighbor_index if neighbor_is_child else leaves[neighbor_index - child_num]
                    subtree_node['child_network'].iloc[dsc_index, neighbor_order] = neighbor_id
                    subtree_node['child_network_is_child'].iloc[dsc_index, neighbor_order] = 0 if neighbor_is_child else -1

    def _inherit_subtree_node(self, leaf_ids_in_child, subtree_node):
        child_subs = [subtree_node['subs'][leaf_id] for leaf_id in leaf_ids_in_child]
        child_subs_items_k_dist = {sub: self.subs_items_k_dist[sub] for sub in child_subs}
        if subtree_node['is_top_child']:
            global_traversal_order = subtree_node['self_global_traversal_order']
        else:
            global_traversal_order = subtree_node['global_traversal_order']
        return self.init_subtree_node(subtree_node['is_root'], child_subs, self.subs_dist_df, child_subs_items_k_dist, global_traversal_order)
    
    def _aggregate_subtree_node(self, child_cluster_id, subtree_node, child_subtree_node):
        # aggr_dims
        subtree_node['aggr_dims'] = list(map(add, subtree_node['aggr_dims'], child_subtree_node['aggr_dims']))
        # aggr_items_dist
        subtree_node['aggr_items_dist'][:] = [dist * subtree_node['aggr_elem_num'] for dist in subtree_node['aggr_items_dist']]
        subtree_node['aggr_items_dist'] = list(map(add, subtree_node['aggr_items_dist'], [dist * child_subtree_node['aggr_elem_num'] for dist in child_subtree_node['aggr_items_dist']]))
        subtree_node['aggr_items_dist'][:] = [dist / (subtree_node['aggr_elem_num'] + child_subtree_node['aggr_elem_num']) for dist in subtree_node['aggr_items_dist']]
        # aggr_elem_num
        subtree_node['aggr_elem_num'] += child_subtree_node['aggr_elem_num']
        # city map
        # 1). center leaf
        if subtree_node['center_vec'][1] == 0:
            # the center is a child, not a direct leaf
            if subtree_node['center_vec'][0] == child_cluster_id:
                # this node comes from the center child
                subtree_node['center_vec'][0] = child_subtree_node['center_vec'][0]
                subtree_node['center_vec'][1] = -1
    
    def _collect_subtree_node(self, leaf_id, leaf_index, subtree_node):
        # aggr_dims
        sub = subtree_node['subs'][leaf_id]
        sub_dim = self._get_sub_dim(sub)
        subtree_node['aggr_dims'] = list(map(add, subtree_node['aggr_dims'], sub_dim))
        # aggr_items_dist
        leaf_items_k_dist = subtree_node['subs_items_k_dist'][sub]
        subtree_node['aggr_items_dist'][:] = [dist * subtree_node['aggr_elem_num'] for dist in subtree_node['aggr_items_dist']]
        subtree_node['aggr_items_dist'] = list(map(add, subtree_node['aggr_items_dist'], leaf_items_k_dist))
        subtree_node['aggr_items_dist'][:] = [dist / (subtree_node['aggr_elem_num'] + 1) for dist in subtree_node['aggr_items_dist']]
        # aggr_elem_num
        subtree_node['aggr_elem_num'] += 1
        # global_traversal_order
        # top-level subtree: uses its own glbOrder
        # non-top-level subtree: use the inherited glbOrder
        # root: does not use glbOrder at all
        if not subtree_node['is_root']:
            if subtree_node['is_top_child']:
                subtree_node['self_global_traversal_order'].append(leaf_index)
            else:
                subtree_node['global_traversal_order'].append(leaf_index)
    
    def _get_sub_dim(self, sub):
        sub_dim = []
        for dim in sub:
            if dim == '0':
                sub_dim.append(0)
            else:
                sub_dim.append(1)
        return sub_dim

    def _get_path2this(self, path2parent, cluster_id, is_root):
        if is_root:
            path2this = []
        else:
            path2this = deepcopy(path2parent)
            path2this.append(cluster_id)
        return path2this
    
    def get_subs_data_proj(self, apply_transformation=True):
        file_path = os.path.join(self.parent_dir, 'subs_data_proj.txt')
        if os.path.isfile(file_path):
            with open (file_path, 'rb') as fp:
                subs_data_proj = pickle.load(fp)
        else:
            subs_data_proj = []
            ref_Y = None
            for idx, sub in enumerate(tqdm(self.subs)):
                # print('Processing', (idx + 1), '/', self.sub_num, ' projections')
                sub_dim = []
                for i, dim in enumerate(sub):
                    if dim == '1':
                        sub_dim.append(i)
                sub_data = self.data.iloc[:, sub_dim].to_numpy()
                X = distance_matrix(sub_data, sub_data)
                embedding = MDS(n_components=2, dissimilarity="precomputed", random_state=6)
                Y = embedding.fit_transform(X)
                if apply_transformation:
                    if idx == 0:
                        Y, _, _ = procrustes(Y, Y)
                        ref_Y = np.copy(Y)
                    else:
                        _, Y, _ = procrustes(ref_Y, Y)
                
                # local scale
                scaler = MinMaxScaler()
                Y = scaler.fit_transform(Y)
                Y = Y.tolist()

                subs_data_proj.append(Y)
            
            # # global scale
            # subs_data_proj = np.array(subs_data_proj)
            # x_min_range = []
            # x_max_range = []
            # y_min_range = []
            # y_max_range = []
            # for sub_data_proj in subs_data_proj:
            #     xy_min = np.amin(sub_data_proj, axis=0)
            #     xy_max = np.amax(sub_data_proj, axis=0)
            #     x_min_range.append(xy_min[0])
            #     y_min_range.append(xy_min[1])
            #     x_max_range.append(xy_max[0])
            #     y_max_range.append(xy_max[1])
            # x_range = [np.amin(x_min_range), np.amax(x_max_range)]
            # y_range = [np.amin(y_min_range), np.amax(y_max_range)]
            # scaler = MinMaxScaler()
            # scaler.fit([[x_range[0], y_range[0]], [x_range[1], y_range[1]]])
            # for i, _ in enumerate(subs_data_proj):
            #     subs_data_proj[i] = scaler.transform(subs_data_proj[i])
            # subs_data_proj = subs_data_proj.tolist()

            with open(file_path, 'wb') as fp:
                pickle.dump(subs_data_proj, fp)
        return subs_data_proj
    
    def save_res(self):
        res = {}
        res['dims'] = self.dims
        res['subs'] = self.subs
        res['colors'] = list(self.subs_color.values())
        res['subDistMat'] = self.subs_dist_df.values.tolist()
        res['subKNN'] = list(self.subs_k_neighbors.values())
        res['subHierClusters'] = self._substr2index_in_cluster(self.subs_hier_clusters)
        res['subtree'] = self.subtree
        res['subProjs'] = list(self.subs_proj.values())
        res['dataProjs'] = list(self.subs_data_proj)
        res['dataWeights'] = list(self.subs_items_k_dist.values())
        res_dir = os.path.join(self.parent_dir, 'result.json')
        res_dir2 = os.path.join(os.path.abspath(os.path.dirname(os.getcwd())), 'client/static/data', self.dataset, 'result.json')
        with open(res_dir, 'w') as fp:
            json.dump(res, fp)
        with open(res_dir2, 'w') as fp:
            json.dump(res, fp)
    
    def _substr2index_in_cluster(self, clusters):
        index_clusters = []
        for item in clusters:
            if isinstance(item, list):
                index_clusters.append(self._substr2index_in_cluster(item))
            else:
                index_clusters.append(self.subs.index(item))
        return index_clusters

# pre = Preprocess('Pendigits-test', output_subs=
# ["4_12", "4_11", "4_16", "4_5", "4_6", "4_9", "4_7", "4_15", "4_14", "4_13", "4_8", "1_4", "4_10", "2_4", "3_4", "11_12", "12_16", "12_15", "12_14", "1_12", "10_12", "11_16", "5_11", "9_11", "11_15", "2_11", "5_16", "6_16", "9_16", "7_16", "15_16", "14_16", "13_16", "8_16", "1_16", "10_16", "2_16", "3_16", "5_15", "1_5", "6_15", "1_6", "2_6", "7_9", "9_15", "9_14", "9_13", "9_10", "2_9", "7_15", "14_15", "13_15", "8_15", "1_15", "10_15", "2_15", "3_15", "1_14", "10_14", "2_14", "1_8", "1_10", "1_2", "1_3", "4_11_12", "4_12_16", "4_12_15", "4_12_14", "4_10_12", "1_4_12", "4_11_16", "4_5_11", "4_9_11", "4_11_15", "2_4_11", "4_5_16", "4_6_16", "4_9_16", "4_7_16", "4_15_16", "4_14_16", "4_13_16", "4_8_16", "4_10_16", "1_4_16", "2_4_16", "3_4_16", "4_5_15", "1_4_5", "4_6_15", "1_4_6", "2_4_6", "4_7_9", "4_9_15", "4_9_14", "4_9_13", "4_9_10", "2_4_9", "4_7_15", "4_14_15", "4_13_15", "4_8_15", "4_10_15", "1_4_15", "2_4_15", "3_4_15", "4_10_14", "1_4_14", "2_4_14", "1_4_8", "1_2_4", "1_3_4", "1_4_10", "11_12_16", "11_12_15", "12_15_16", "12_14_16", "1_12_16", "10_12_16", "12_14_15", "1_12_15", "10_12_15", "1_12_14", "10_12_14", "1_10_12", "11_15_16", "5_11_16", "9_11_16", "2_11_16", "5_11_15", "2_9_11", "9_11_15", "2_11_15", "5_15_16", "1_5_16", "6_15_16", "1_6_16", "2_6_16", "7_9_16", "9_15_16", "9_14_16", "9_13_16", "9_10_16", "2_9_16", "7_15_16", "14_15_16", "13_15_16", "8_15_16", "1_15_16", "10_15_16", "2_15_16", "3_15_16", "1_14_16", "10_14_16", "2_14_16", "1_8_16", "1_10_16", "1_2_16", "1_3_16", "1_5_15", "1_6_15", "2_6_15", "1_2_6", "7_9_15", "9_14_15", "9_13_15", "9_10_15", "2_9_15", "9_10_14", "2_9_14", "1_14_15", "10_14_15", "2_14_15", "1_8_15", "1_10_15", "1_2_15", "1_3_15", "1_10_14", "1_2_14", "4_11_12_16", "4_11_12_15", "4_12_15_16", "4_12_14_16", "1_4_12_16", "4_12_14_15", "4_10_12_15", "1_4_12_15", "4_10_12_14", "1_4_12_14", "1_4_10_12", "4_11_15_16", "4_5_11_16", "4_9_11_16", "2_4_11_16", "4_5_11_15", "4_9_11_15", "2_4_9_11", "2_4_11_15", "4_5_15_16", "1_4_5_16", "4_6_15_16", "1_4_6_16", "2_4_6_16", "4_9_15_16", "4_9_14_16", "4_9_13_16", "2_4_9_16", "4_7_15_16", "4_14_15_16", "4_13_15_16", "4_8_15_16", "4_10_15_16", "1_4_15_16", "2_4_15_16", "3_4_15_16", "4_10_14_16", "1_4_14_16", "2_4_14_16", "1_4_10_16", "1_2_4_16", "1_3_4_16", "1_4_5_15", "1_4_6_15", "2_4_6_15", "1_2_4_6", "4_7_9_15", "4_9_14_15", "4_9_13_15", "4_9_10_15", "2_4_9_15", "4_9_10_14", "2_4_9_14", "4_10_14_15", "1_4_14_15", "2_4_14_15", "1_4_8_15", "1_4_10_15", "1_2_4_15", "1_3_4_15", "1_4_10_14", "1_2_4_14", "11_12_15_16", "12_14_15_16", "1_12_15_16", "10_12_15_16", "1_12_14_16", "1_12_14_15", "10_12_14_15", "1_10_12_15", "1_10_12_14", "5_11_15_16", "9_11_15_16", "2_11_15_16", "2_9_11_16", "2_9_11_15", "1_5_15_16", "1_6_15_16", "2_6_15_16", "1_2_6_16", "7_9_15_16", "9_14_15_16", "9_13_15_16", "9_10_15_16", "2_9_15_16", "1_14_15_16", "10_14_15_16", "2_14_15_16", "1_8_15_16", "1_10_15_16", "1_2_15_16", "1_3_15_16", "1_2_6_15", "9_10_14_15", "2_9_14_15", "1_10_14_15", "1_2_14_15", "4_11_12_15_16", "4_12_14_15_16", "1_4_12_15_16", "1_4_12_14_16", "4_10_12_14_15", "1_4_12_14_15", "1_4_10_12_15", "1_4_10_12_14", "4_5_11_15_16", "4_9_11_15_16", "2_4_11_15_16", "2_4_9_11_16", "2_4_9_11_15", "1_4_5_15_16", "1_4_6_15_16", "2_4_6_15_16", "1_2_4_6_16", "4_9_14_15_16", "4_9_13_15_16", "2_4_9_15_16", "4_10_14_15_16", "1_4_14_15_16", "2_4_14_15_16", "1_4_10_15_16", "1_2_4_15_16", "1_3_4_15_16", "1_2_4_6_15", "4_9_10_14_15", "2_4_9_14_15", "1_4_10_14_15", "1_2_4_14_15", "1_12_14_15_16", "1_10_12_14_15", "2_9_11_15_16", "1_2_6_15_16", "1_4_12_14_15_16", "1_4_10_12_14_15", "2_4_9_11_15_16", "1_2_4_6_15_16"]
# )

# Forestfires Data: 8 dims, 247 subspaces, sample_rate = 1.0
pre = Preprocess('Forestfires')

pre.process()